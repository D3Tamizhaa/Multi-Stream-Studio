/**
 * Core streaming engine.
 *
 * Reads the current scene graph (scenes -> sources) and the Output /
 * Video / Audio settings out of the JSON store, builds a single FFmpeg
 * command that:
 *   1. composites every visible source of the active scene into one
 *      video frame (images & media via scale+overlay, text via
 *      drawtext) using -filter_complex,
 *   2. mixes the audio of every media source together,
 *   3. encodes the result exactly once, and
 *   4. fans it out to every enabled platform simultaneously using
 *      FFmpeg's "tee" muxer (one encode, N destinations - keeps this
 *      "ultra-lightweight" instead of spawning N encoders).
 *
 * Known limitations (documented, intentional trade-offs for an
 * ultra-lightweight single-process design):
 *  - Changing scenes/sources while live restarts the encoder
 *    (sub-second gap) rather than hot-swapping filters.
 *  - Non-looped media sources that finish playing are not
 *    auto-removed from a running composition; enable "Loop" for
 *    anything that must last the whole stream.
 *  - The Audio Mixer's Mute control is local-monitoring only (per the
 *    spec) and therefore only affects the browser preview, never the
 *    server-side mix that gets streamed - Volume affects both.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { getVideoEncoderInfo, getAudioCodec } = require('./encoderCapabilities');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

let ffmpegProcess = null;
let startedAt = null;
let lastError = null;
let restartTimer = null;

function resolveResolution(video) {
  if (video.resolution === 'Custom') {
    return { width: video.customWidth || 1280, height: video.customHeight || 720 };
  }
  const [w, h] = video.resolution.split('x').map(Number);
  return { width: w || 1280, height: h || 720 };
}

function channelsToCount(channels) {
  switch (channels) {
    case 'Mono': return 1;
    case '5.1 surround': return 6;
    case '7.1 surround': return 8;
    case 'Stereo':
    default: return 2;
  }
}

function ffPresetName(preset) {
  return String(preset || '').toLowerCase().replace(/\s+/g, '');
}

function ffTuneName(tune) {
  return String(tune || '').toLowerCase().replace(/\s+/g, '');
}

function ffProfileName(profile) {
  return String(profile || '').toLowerCase().replace(/\s+/g, '');
}

/** Builds -c:v ... rate-control/preset/profile/tune/keyframe args. */
function buildVideoEncoderArgs(videoSettings, fps) {
  const info = getVideoEncoderInfo(videoSettings.encoder);
  const args = ['-c:v', info.codec];
  if (info.codec === 'copy') return args;

  const isNvenc = info.codec.endsWith('_nvenc');
  const isQsv = info.codec.endsWith('_qsv');
  const isAmf = info.codec.endsWith('_amf');
  const value = Number(videoSettings.bitrate) || 2500; // reused as bitrate/CRF/QP/CQ depending on rateControl

  // Preset
  if (videoSettings.preset && videoSettings.preset !== 'None') {
    args.push('-preset', ffPresetName(videoSettings.preset));
  }

  // Rate control
  switch (videoSettings.rateControl) {
    case 'CBR':
      args.push('-b:v', `${value}k`, '-minrate', `${value}k`, '-maxrate', `${value}k`, '-bufsize', `${value * 2}k`);
      if (isNvenc) args.push('-rc', 'cbr');
      break;
    case 'VBR':
      args.push('-b:v', `${value}k`, '-maxrate', `${Math.round(value * 1.5)}k`, '-bufsize', `${value * 2}k`);
      if (isNvenc) args.push('-rc', 'vbr');
      break;
    case 'ABR':
      args.push('-b:v', `${value}k`);
      break;
    case 'VBV':
      args.push('-b:v', `${value}k`, '-maxrate', `${value}k`, '-bufsize', `${value * 2}k`);
      break;
    case 'CRF':
      args.push('-crf', String(value));
      break;
    case 'QP':
      args.push(isQsv ? '-global_quality' : '-qp', String(value));
      break;
    case 'CQ':
      if (isNvenc) args.push('-rc', 'vbr', '-cq', String(value));
      else if (isQsv) args.push('-global_quality', String(value));
      else args.push('-crf', String(value)); // vp9/av1 use -crf as their "cq" equivalent
      break;
    case 'None':
    default:
      break; // let the encoder pick its own defaults
  }

  // Keyframe interval (seconds -> frames)
  if (info.keyframeInterval && videoSettings.keyframeInterval) {
    const gop = Math.max(1, Math.round(Number(videoSettings.keyframeInterval) * (fps || 30)));
    args.push('-g', String(gop), '-keyint_min', String(gop));
  }

  // Profile
  if (videoSettings.profile && videoSettings.profile !== 'None') {
    args.push('-profile:v', ffProfileName(videoSettings.profile));
  }

  // Tune
  if (videoSettings.tune && videoSettings.tune !== 'None') {
    if (isNvenc) {
      args.push('-tune', videoSettings.tune === 'Zero latency' ? 'll' : 'hq');
    } else if (!isQsv && !isAmf) {
      args.push('-tune', ffTuneName(videoSettings.tune));
    }
  }

  args.push('-pix_fmt', 'yuv420p');
  return args;
}

function buildAudioEncoderArgs(audioSettings) {
  const codec = getAudioCodec(audioSettings.encoder);
  if (codec === 'copy') return ['-c:a', 'copy'];
  const args = ['-c:a', codec];
  if (audioSettings.bitrate) args.push('-b:a', `${audioSettings.bitrate}k`);
  return args;
}

function escapeDrawtext(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '\u2019');
}

function findFont(fontFamily) {
  // Best-effort: fall back to a bundled DejaVu font that ships with
  // most Linux systems / fontconfig installs. Users can drop custom
  // .ttf files into server/assets/fonts/<Name>.ttf to add fonts.
  const bundled = path.join(__dirname, '..', 'assets', 'fonts', `${fontFamily}.ttf`);
  if (fontFamily && fs.existsSync(bundled)) return bundled;
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    'C:/Windows/Fonts/arial.ttf'
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * Builds the full argv for ffmpeg: inputs + filter_complex + encoder
 * args + tee output to every enabled platform.
 */
function buildCommand(state) {
  const { width, height } = resolveResolution(state.video);
  const fps = state.video.fps || 30;
  const activeSceneId = state.activeSceneId;
  const sources = state.sources
    .filter((s) => s.sceneId === activeSceneId && s.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const inputArgs = [];
  let inputIndex = 0;
  const overlayChain = [];
  const audioLabels = [];

  inputArgs.push('-f', 'lavfi', '-re', '-i', `color=size=${width}x${height}:rate=${fps}:color=black`);
  let videoLabel = `${inputIndex}:v`;
  inputIndex += 1;

  for (const src of sources) {
    if (src.type === 'image') {
      const filePath = path.join(db.UPLOADS_DIR, src.file || '');
      if (!fs.existsSync(filePath)) continue;
      inputArgs.push('-loop', '1', '-framerate', String(fps), '-re', '-i', filePath);
      const idx = inputIndex++;
      const scaled = `img${idx}`;
      overlayChain.push(`[${idx}:v]scale=${Math.round(src.width) || 320}:${Math.round(src.height) || 180}[${scaled}]`);
      const nextLabel = `ov${idx}`;
      overlayChain.push(`[${videoLabel}][${scaled}]overlay=${Math.round(src.x) || 0}:${Math.round(src.y) || 0}[${nextLabel}]`);
      videoLabel = nextLabel;
    } else if (src.type === 'media') {
      const filePath = path.join(db.UPLOADS_DIR, src.file || '');
      if (!fs.existsSync(filePath)) continue;
      const isAudioOnly = /\.mp3$/i.test(src.file || '');
      const loopArgs = src.loop ? ['-stream_loop', '-1'] : [];
      inputArgs.push(...loopArgs, '-re', '-i', filePath);
      const idx = inputIndex++;
      if (!isAudioOnly) {
        const scaled = `med${idx}`;
        overlayChain.push(`[${idx}:v]scale=${Math.round(src.width) || 320}:${Math.round(src.height) || 180}[${scaled}]`);
        const nextLabel = `ov${idx}`;
        overlayChain.push(`[${videoLabel}][${scaled}]overlay=${Math.round(src.x) || 0}:${Math.round(src.y) || 0}[${nextLabel}]`);
        videoLabel = nextLabel;
      }
      const vol = src.volume === undefined ? 1 : Number(src.volume);
      const aLabel = `a${idx}`;
      overlayChain.push(`[${idx}:a]volume=${vol}[${aLabel}]`);
      audioLabels.push(aLabel);
    } else if (src.type === 'text') {
      const fontFile = findFont(src.fontFamily);
      const parts = [
        `text='${escapeDrawtext(src.text)}'`,
        `fontsize=${Math.round(src.fontSize) || 32}`,
        `fontcolor=${src.color || 'white'}`,
        `x=${Math.round(src.x) || 0}`,
        `y=${Math.round(src.y) || 0}`
      ];
      if (fontFile) parts.unshift(`fontfile='${fontFile}'`);
      const nextLabel = `txt${overlayChain.length}`;
      overlayChain.push(`[${videoLabel}]drawtext=${parts.join(':')}[${nextLabel}]`);
      videoLabel = nextLabel;
    }
  }

  // Final video label
  overlayChain.push(`[${videoLabel}]null[vout]`);

  // Audio mix
  if (audioLabels.length > 0) {
    overlayChain.push(`${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0[aout]`);
  } else {
    inputArgs.push('-f', 'lavfi', '-i', `anullsrc=r=${state.audio.sampleRate || 48000}:cl=stereo`);
    overlayChain.push(`[${inputIndex}:a]anull[aout]`);
    inputIndex += 1;
  }

  const filterComplex = overlayChain.join(';');

  const outputSettings = state.output.mode === 'advanced'
    ? state.output.advanced
    : {
      video: { encoder: state.output.simple.videoEncoder, rateControl: 'CBR', bitrate: state.output.simple.videoBitrate, keyframeInterval: 2, preset: state.output.simple.preset, profile: 'None', tune: 'None' },
      audio: { encoder: state.output.simple.audioEncoder, bitrate: state.output.simple.audioBitrate }
    };

  const videoArgs = buildVideoEncoderArgs(outputSettings.video, fps);
  const audioArgs = buildAudioEncoderArgs(outputSettings.audio);
  const audioExtra = ['-ar', String(state.audio.sampleRate || 48000), '-ac', String(channelsToCount(state.audio.channels))];

  const enabledPlatforms = state.platforms.filter((p) => p.enabled);
  const teeTargets = enabledPlatforms.map((p) => {
    const url = p.service === 'rtmp' ? p.server : `${p.server.replace(/\/$/, '')}/${p.streamKey}`;
    return `[f=flv:onfail=ignore]${url}`;
  });

  const args = [
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '[aout]',
    ...videoArgs,
    ...audioArgs,
    ...audioExtra,
    '-f', 'tee',
    teeTargets.join('|')
  ];

  return { args, teeTargets, width, height, fps };
}

function isLive() {
  return !!ffmpegProcess;
}

function getStatus() {
  return {
    live: isLive(),
    uptimeSeconds: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
    lastError
  };
}

function start() {
  if (ffmpegProcess) return { ok: false, error: 'Already streaming.' };
  const state = db.get();
  const enabledPlatforms = state.platforms.filter((p) => p.enabled);
  if (enabledPlatforms.length === 0) {
    return { ok: false, error: 'Enable at least one platform before going live.' };
  }

  const { args } = buildCommand(state);
  lastError = null;

  try {
    ffmpegProcess = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    lastError = err.message;
    return { ok: false, error: err.message };
  }

  startedAt = Date.now();

  let stderrTail = '';
  ffmpegProcess.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-4000);
  });

  ffmpegProcess.on('exit', (code) => {
    const wasRunning = !!ffmpegProcess;
    ffmpegProcess = null;
    startedAt = null;
    if (wasRunning && code !== 0 && code !== null) {
      lastError = `FFmpeg exited with code ${code}. ${stderrTail.split('\n').slice(-3).join(' ')}`;
      const state2 = db.get();
      if (state2.advanced.autoReconnect) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => start(), 3000);
      }
    }
  });

  return { ok: true };
}

function stop() {
  clearTimeout(restartTimer);
  if (!ffmpegProcess) return { ok: true };
  const proc = ffmpegProcess;
  ffmpegProcess = null;
  startedAt = null;
  proc.kill('SIGINT');
  return { ok: true };
}

/** Restarts the live encode (used when scenes/sources change while live). */
function restartIfLive() {
  if (!ffmpegProcess) return;
  stop();
  setTimeout(() => start(), 300);
}

module.exports = { start, stop, getStatus, isLive, restartIfLive, buildCommand, resolveResolution };
