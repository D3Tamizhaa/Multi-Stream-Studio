const { spawn } = require('child_process');
const path = require('path');
const { VIDEO_ENCODERS, AUDIO_ENCODERS } = require('./encoderCapabilities');
const store = require('../store');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

let ffmpegProcess = null;
let startedAt = null;
let currentStatus = 'idle'; // idle | starting | live | error | stopping
let lastError = null;
let ioRef = null;

function attachIo(io) {
  ioRef = io;
}

function emitStatus() {
  const payload = getStatus();
  if (ioRef) ioRef.emit('stream:status', payload);
}

function getStatus() {
  const uptimeSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  return { status: currentStatus, uptimeSeconds, lastError };
}

function resolutionFromSettings(video) {
  if (video.resolution === 'Custom') {
    return { w: video.customWidth || 1920, h: video.customHeight || 1080 };
  }
  const [w, h] = video.resolution.split('x').map(Number);
  return { w: w || 1920, h: h || 1080 };
}

function escapeDrawtext(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

function hexToDrawtextColor(hexOrRgba) {
  // Accept #RRGGBB, #RRGGBBAA, or rgba(r,g,b,a). Falls back to white.
  if (!hexOrRgba) return 'white';
  const v = hexOrRgba.trim();
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (hex.length === 6) return `0x${hex}`;
    if (hex.length === 8) return `0x${hex.slice(0, 6)}@0x${hex.slice(6)}`;
    return 'white';
  }
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(',').map((s) => s.trim());
    const [r, g, b, a] = parts;
    const toHex = (n) => Number(n).toString(16).padStart(2, '0');
    const rgb = `${toHex(r)}${toHex(g)}${toHex(b)}`;
    if (a !== undefined) {
      const alpha = Math.round(Number(a) * 255).toString(16).padStart(2, '0');
      return `0x${rgb}@0x${alpha}`;
    }
    return `0x${rgb}`;
  }
  return v; // assume it's already an ffmpeg-understood color name
}

/**
 * Builds the full ffmpeg argv for compositing the active scene and pushing
 * it to every enabled platform via the `tee` muxer.
 */
function buildFfmpegArgs({ scene, platforms, settings }) {
  const { video, audio, output } = settings;
  const { w, h } = resolutionFromSettings(video);
  const fps = video.fps || 30;

  const shownSources = (scene.sources || []).filter((s) => s.shown !== false);

  const args = ['-y'];
  const inputLabels = []; // index into ffmpeg -i list, in order added
  const filterParts = [];

  // Base canvas (black), acts as input 0
  args.push('-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=${fps}`);
  inputLabels.push({ kind: 'base' });

  // Silent audio bed as a fallback so `amix`/output always has an audio track
  args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  inputLabels.push({ kind: 'silence' });

  const mediaAudioLabels = [];
  let overlayChain = '[0:v]';
  let vIdx = 0;

  shownSources.forEach((src) => {
    if (src.type === 'image') {
      const filePath = path.join(UPLOADS_DIR, src.file || '');
      args.push('-loop', '1', '-i', filePath);
      const inIdx = inputLabels.length;
      inputLabels.push({ kind: 'image', src });
      const scaled = `s${inIdx}`;
      filterParts.push(`[${inIdx}:v]scale=${Math.round(src.width) || 320}:${Math.round(src.height) || 180}[${scaled}]`);
      const next = `v${vIdx++}`;
      filterParts.push(`${overlayChain}[${scaled}]overlay=${Math.round(src.x) || 0}:${Math.round(src.y) || 0}[${next}]`);
      overlayChain = `[${next}]`;
    } else if (src.type === 'media') {
      const filePath = path.join(UPLOADS_DIR, src.file || '');
      if (src.loop) args.push('-stream_loop', '-1');
      args.push('-i', filePath);
      const inIdx = inputLabels.length;
      inputLabels.push({ kind: 'media', src });
      const scaled = `s${inIdx}`;
      filterParts.push(`[${inIdx}:v]scale=${Math.round(src.width) || 640}:${Math.round(src.height) || 360}[${scaled}]`);
      const next = `v${vIdx++}`;
      filterParts.push(`${overlayChain}[${scaled}]overlay=${Math.round(src.x) || 0}:${Math.round(src.y) || 0}:shortest=0[${next}]`);
      overlayChain = `[${next}]`;

      // Audio: include unless "Monitor Only" (excluded from output) or explicitly muted
      const monitor = src.monitor || 'Monitor and Output';
      const muted = !!src.muted;
      if (monitor !== 'Monitor Only' && !muted) {
        const vol = typeof src.volume === 'number' ? src.volume : 1;
        const aLabel = `a${inIdx}`;
        filterParts.push(`[${inIdx}:a]volume=${vol}[${aLabel}]`);
        mediaAudioLabels.push(`[${aLabel}]`);
      }
    } else if (src.type === 'text') {
      const next = `v${vIdx++}`;
      const fontsize = Math.round(src.fontSize) || 32;
      const color = hexToDrawtextColor(src.color);
      const text = escapeDrawtext(src.text);
      const fontOpt = src.fontFamily ? `:font='${src.fontFamily.replace(/'/g, "")}'` : '';
      filterParts.push(
        `${overlayChain}drawtext=text='${text}'${fontOpt}:fontsize=${fontsize}:fontcolor=${color}:x=${Math.round(src.x) || 0}:y=${Math.round(src.y) || 0}[${next}]`
      );
      overlayChain = `[${next}]`;
    }
  });

  // Final video label: whatever pad `overlayChain` currently points to (could be the
  // untouched base canvas [0:v] if there were no video sources) gets a trailing no-op
  // filter that renames it to a stable [vout] pad for -map. This is robust regardless
  // of what other filters (e.g. a trailing audio `volume` filter) were pushed last.
  filterParts.push(`${overlayChain}null[vout]`);

  // Audio mix: silence bed + any included media audio
  const audioInputs = ['[1:a]', ...mediaAudioLabels];
  filterParts.push(`${audioInputs.join('')}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=0[aout]`);

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[vout]', '-map', '[aout]');

  // ---- Encoding settings ----
  const isSimple = output.mode === 'simple';
  const videoLabel = isSimple ? output.simple.video.encoder : output.advanced.video.encoder;
  const videoDef = VIDEO_ENCODERS[videoLabel] || VIDEO_ENCODERS['H.264'];
  args.push('-c:v', videoDef.ffmpeg);

  if (videoDef.ffmpeg !== 'copy') {
    const bitrate = isSimple ? output.simple.video.bitrate : output.advanced.video.bitrate;
    const rateControl = isSimple ? 'CBR' : output.advanced.video.rateControl;

    if (rateControl === 'CRF' && videoDef.rateControl.includes('CRF')) {
      args.push('-crf', String(output.advanced.video.crf || 23));
    } else if (['CQ', 'QP', 'CQP'].includes(rateControl)) {
      args.push('-qp', String(output.advanced.video.qp || 20));
    } else {
      // CBR / VBR / VBV / ABR / default: drive off bitrate
      args.push('-b:v', `${bitrate}k`);
      if (rateControl === 'CBR') args.push('-minrate', `${bitrate}k`, '-maxrate', `${bitrate}k`, '-bufsize', `${bitrate * 2}k`);
      if (rateControl === 'VBV') args.push('-maxrate', `${bitrate}k`, '-bufsize', `${bitrate * 2}k`);
    }

    const preset = isSimple ? output.simple.preset : output.advanced.video.preset;
    if (preset && preset !== 'None' && videoDef.preset.includes(preset)) {
      args.push('-preset', preset.toLowerCase().replace(/ /g, ''));
    }
    if (!isSimple) {
      const profile = output.advanced.video.profile;
      if (profile && profile !== 'None' && videoDef.profile.includes(profile)) {
        args.push('-profile:v', profile.toLowerCase().replace(/ /g, ''));
      }
      const tune = output.advanced.video.tune;
      if (tune && tune !== 'None' && videoDef.tune.includes(tune)) {
        args.push('-tune', tune.toLowerCase().replace(/ /g, ''));
      }
      const gop = output.advanced.video.keyframeInterval;
      if (videoDef.keyframeInterval && gop) {
        args.push('-g', String(Math.round(gop * fps)), '-keyint_min', String(Math.round(gop * fps)));
      }
    }
  }

  args.push('-pix_fmt', 'yuv420p', '-r', String(fps), '-s', `${w}x${h}`);

  const audioLabel = isSimple ? output.simple.audio.encoder : output.advanced.audio.encoder;
  const audioDef = AUDIO_ENCODERS[audioLabel] || AUDIO_ENCODERS['AAC'];
  args.push('-c:a', audioDef.ffmpeg);
  if (audioDef.ffmpeg !== 'copy' && audioDef.bitrates.length) {
    const abitrate = isSimple ? output.simple.audio.bitrate : output.advanced.audio.bitrate;
    args.push('-b:a', `${abitrate}k`);
  }
  const sampleRate = (audio.sampleRate || '48 kHz').includes('44.1') ? 44100 : 48000;
  args.push('-ar', String(sampleRate));
  const channelMap = { Mono: 1, Stereo: 2, '5.1 surround': 6, '7.1 surround': 8 };
  args.push('-ac', String(channelMap[audio.channels] || 2));

  // ---- Output: fan out to every enabled platform via tee ----
  const urls = platforms
    .filter((p) => p.enabled)
    .map((p) => `[f=flv]${p.rtmpUrl}`)
    .join('|');

  if (!urls) {
    throw new Error('No enabled platforms to stream to. Enable at least one platform first.');
  }

  args.push('-f', 'tee', urls);

  return args;
}

function start({ scene, platforms, settings }) {
  if (ffmpegProcess) throw new Error('Stream is already running.');

  const args = buildFfmpegArgs({ scene, platforms, settings });
  currentStatus = 'starting';
  lastError = null;
  emitStatus();

  ffmpegProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  ffmpegProcess.stderr.on('data', (chunk) => {
    const line = chunk.toString();
    // FFmpeg logs progress to stderr; treat first "frame=" as confirmation we're live.
    if (currentStatus === 'starting' && /frame=/.test(line)) {
      currentStatus = 'live';
      startedAt = Date.now();
      emitStatus();
    }
    if (ioRef) ioRef.emit('stream:log', line);
  });

  ffmpegProcess.on('exit', (code, signal) => {
    const wasStopping = currentStatus === 'stopping';
    ffmpegProcess = null;
    startedAt = null;
    if (wasStopping || code === 0) {
      currentStatus = 'idle';
    } else {
      currentStatus = 'error';
      lastError = `ffmpeg exited with code ${code}${signal ? ` (signal ${signal})` : ''}`;
    }
    emitStatus();
  });

  ffmpegProcess.on('error', (err) => {
    currentStatus = 'error';
    lastError = `Failed to launch ffmpeg: ${err.message}. Is ffmpeg installed and on PATH?`;
    ffmpegProcess = null;
    startedAt = null;
    emitStatus();
  });

  return { commandPreview: `ffmpeg ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}` };
}

function stop() {
  if (!ffmpegProcess) return;
  currentStatus = 'stopping';
  emitStatus();
  // 'q' triggers ffmpeg's graceful shutdown; fall back to SIGTERM shortly after.
  try {
    ffmpegProcess.stdin && ffmpegProcess.stdin.write('q');
  } catch {}
  setTimeout(() => {
    if (ffmpegProcess) ffmpegProcess.kill('SIGTERM');
  }, 1500);
}

function restartIfLive() {
  if (currentStatus === 'live' || currentStatus === 'starting') {
    const scenesData = store.getScenes();
    const scene = scenesData.scenes.find((s) => s.id === scenesData.activeSceneId);
    const platforms = store.getPlatforms().platforms;
    const settings = store.getSettings();
    stop();
    setTimeout(() => {
      try {
        start({ scene, platforms, settings });
      } catch (e) {
        lastError = e.message;
        currentStatus = 'error';
        emitStatus();
      }
    }, 1800);
  }
}

module.exports = { start, stop, getStatus, attachIo, restartIfLive, buildFfmpegArgs };
