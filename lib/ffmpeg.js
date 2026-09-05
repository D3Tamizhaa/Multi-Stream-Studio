'use strict';
const { spawn } = require('child_process');
const path = require('path');
const enc = require('./encoders');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

let proc = null;
let status = 'idle'; // idle | starting | live | stopping | error
let startedAt = null;
let lastError = null;
const logTail = [];

function pushLog(line) {
  logTail.push(line);
  if (logTail.length > 300) logTail.shift();
}

const SERVICE_DEFAULT_SERVER = {
  YouTube: 'rtmp://a.rtmp.youtube.com/live2',
  Facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
  Twitch: 'rtmp://live.twitch.tv/app',
  Kick: 'rtmps://live.kick.com/app' // confirm current ingest URL from your Kick dashboard
};

function resolveFps(fpsValue) {
  const map = { 29.97: '30000/1001', 59.94: '60000/1001' };
  return map[fpsValue] || String(fpsValue);
}

function resolveResolution(video) {
  if (video.resolution === 'Custom') {
    return { w: Number(video.customWidth) || 1280, h: Number(video.customHeight) || 720 };
  }
  const [w, h] = String(video.resolution).split('x').map(Number);
  return { w: w || 1280, h: h || 720 };
}

function resolveSampleRate(s) {
  return s === '44.1 kHz' ? 44100 : 48000;
}
function resolveChannels(c) {
  return { Mono: 1, Stereo: 2, '5.1 surround': 6, '7.1 surround': 8 }[c] || 2;
}

function escapeDrawtext(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function filePath(relOrAbs) {
  if (!relOrAbs) return null;
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.join(UPLOADS_DIR, relOrAbs);
}

/**
 * Build rate-control related ffmpeg args for the video encoder.
 * Approximation layer: real-world flags vary by encoder/driver;
 * this produces a working, sane result for common cases.
 */
function buildVideoRateArgs(ffmpegName, rateControl, bitrate) {
  const kbps = Number(bitrate) || 2500;
  const isHW = /nvenc|qsv|amf/.test(ffmpegName);
  switch (rateControl) {
    case 'CBR':
      return ['-b:v', `${kbps}k`, '-minrate', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`];
    case 'VBR':
      return ['-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`];
    case 'VBV':
      return ['-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${Math.round(kbps * 1.5)}k`];
    case 'ABR':
      return ['-b:v', `${kbps}k`];
    case 'CRF':
      return ['-crf', String(kbps)];
    case 'CQ':
      return isHW ? ['-rc', 'vbr', '-cq', String(kbps), '-b:v', '0'] : ['-crf', String(kbps)];
    case 'QP':
      return isHW ? ['-rc', 'constqp', '-qp', String(kbps)] : ['-qp', String(kbps)];
    case 'None':
    default:
      return [];
  }
}

function buildVideoEncoderArgs(outputSettings, resolution) {
  const mode = outputSettings.mode;
  if (mode === 'simple') {
    const s = outputSettings.simple;
    const cfg = enc.VIDEO_ENCODERS[s.videoEncoder] || enc.VIDEO_ENCODERS['H.264'];
    if (cfg.ffmpegName === 'copy') return { videoArgs: ['-c:v', 'copy'], audioArgs: null, cfg };
    const args = ['-c:v', cfg.ffmpegName, ...buildVideoRateArgs(cfg.ffmpegName, 'CBR', s.videoBitrate)];
    if (cfg.preset.length && s.preset && s.preset !== 'None') {
      args.push('-preset', enc.PRESET_MAP[s.preset] || 'medium');
    }
    return { videoArgs: args, cfg };
  }
  const v = outputSettings.advanced.video;
  const cfg = enc.VIDEO_ENCODERS[v.encoder] || enc.VIDEO_ENCODERS['H.264'];
  if (cfg.ffmpegName === 'copy') return { videoArgs: ['-c:v', 'copy'], cfg };
  const args = ['-c:v', cfg.ffmpegName, ...buildVideoRateArgs(cfg.ffmpegName, v.rateControl, v.bitrate)];
  if (cfg.preset.length && v.preset && v.preset !== 'None') {
    args.push('-preset', enc.PRESET_MAP[v.preset] || 'medium');
  }
  if (cfg.profile.length && v.profile && v.profile !== 'None') {
    const p = enc.PROFILE_MAP[v.profile];
    if (p) args.push('-profile:v', p);
  }
  if (['libx264', 'libx265'].includes(cfg.ffmpegName) && cfg.tune.length && v.tune && v.tune !== 'None') {
    const t = enc.TUNE_MAP[v.tune];
    if (t) args.push('-tune', t);
  }
  if (cfg.keyframe && v.keyframeInterval) {
    const fpsNum = resolution.fpsNum || 30;
    const g = Math.max(1, Math.round(Number(v.keyframeInterval) * fpsNum));
    args.push('-g', String(g), '-keyint_min', String(g));
    if (cfg.ffmpegName === 'libx264') args.push('-sc_threshold', '0');
  }
  return { videoArgs: args, cfg };
}

function buildAudioEncoderArgs(outputSettings) {
  const mode = outputSettings.mode;
  const encName = mode === 'simple' ? outputSettings.simple.audioEncoder : outputSettings.advanced.audio.encoder;
  const bitrate = mode === 'simple' ? outputSettings.simple.audioBitrate : outputSettings.advanced.audio.bitrate;
  const cfg = enc.AUDIO_ENCODERS[encName] || enc.AUDIO_ENCODERS['AAC'];
  if (cfg.ffmpegName === 'copy') return ['-c:a', 'copy'];
  const args = ['-c:a', cfg.ffmpegName];
  if (cfg.ffmpegName !== 'pcm_s16le' && cfg.ffmpegName !== 'flac') {
    args.push('-b:a', `${Number(bitrate) || 160}k`);
  }
  return args;
}

function buildPlatformTargets(platforms) {
  return platforms.filter(p => p.enabled).map(p => {
    let url;
    if (p.service === 'RTMP') {
      url = `${p.server.replace(/\/$/, '')}/${p.streamKey}`;
    } else {
      const server = p.server || SERVICE_DEFAULT_SERVER[p.service];
      url = `${server.replace(/\/$/, '')}/${p.streamKey}`;
    }
    return `[f=flv:onfail=ignore]${url}`;
  });
}

/**
 * Build the full FFmpeg argument list for the currently active scene.
 */
function buildCommand(db) {
  const scene = db.scenes.find(s => s.id === db.activeSceneId) || db.scenes[0];
  if (!scene) throw new Error('No active scene configured.');
  const { w, h } = resolveResolution(db.settings.video);
  // Editor workspace is a fixed 1280x720 (16:9) logical coordinate space;
  // scale stored source geometry to whatever output resolution is configured.
  const LOGICAL_W = 1280;
  const scale = w / LOGICAL_W;
  const fps = db.settings.video.fps;
  const fpsArg = resolveFps(fps);
  const fpsNum = typeof fps === 'number' ? fps : parseFloat(fps);
  const sampleRate = resolveSampleRate(db.settings.audio.sampleRate);
  const channels = resolveChannels(db.settings.audio.channels);

  const platforms = buildPlatformTargets(db.platforms || []);
  if (platforms.length === 0) throw new Error('No enabled platforms to stream to.');

  const inputs = ['-f', 'lavfi', '-i', `color=size=${w}x${h}:rate=${fpsArg}:color=black`];
  const filters = [];
  let videoLabel = '0:v';
  let inputIndex = 1;
  const audioLabels = [];

  const visibleSources = (scene.sources || []).filter(s => s.visible !== false).sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const src of visibleSources) {
    const sw = Math.max(1, Math.round(src.width * scale));
    const sh = Math.max(1, Math.round(src.height * scale));
    const sx = Math.round(src.x * scale);
    const sy = Math.round(src.y * scale);
    if (src.type === 'image') {
      inputs.push('-loop', '1', '-i', filePath(src.file));
      const idx = inputIndex++;
      filters.push(`[${idx}:v]scale=${sw}:${sh}[s${idx}]`);
      const out = `v${idx}`;
      filters.push(`[${videoLabel}][s${idx}]overlay=${sx}:${sy}[${out}]`);
      videoLabel = out;
    } else if (src.type === 'media') {
      const loopArgs = src.loop ? ['-stream_loop', '-1'] : [];
      inputs.push(...loopArgs, '-i', filePath(src.file));
      const idx = inputIndex++;
      if (src.hasVideo !== false) {
        filters.push(`[${idx}:v]scale=${sw}:${sh}[s${idx}]`);
        const out = `v${idx}`;
        filters.push(`[${videoLabel}][s${idx}]overlay=${sx}:${sy}[${out}]`);
        videoLabel = out;
      }
      if (src.hasAudio !== false) {
        const vol = src.muted ? 0 : (typeof src.volume === 'number' ? src.volume : 1);
        filters.push(`[${idx}:a]volume=${vol}[a${idx}]`);
        audioLabels.push(`a${idx}`);
      }
    }
    // 'text' sources are applied below via drawtext, after all overlays.
  }

  let textCounter = 0;
  for (const src of visibleSources) {
    if (src.type === 'text') {
      const txt = escapeDrawtext(src.text || '');
      const color = src.color || 'white';
      const out = `t${textCounter++}`;
      const fsz = Math.max(1, Math.round((src.fontSize || 32) * scale));
      const tx = Math.round(src.x * scale);
      const ty = Math.round(src.y * scale);
      filters.push(
        `[${videoLabel}]drawtext=font='${(src.fontFamily || 'Sans').replace(/'/g, '')}':text='${txt}':fontsize=${fsz}:fontcolor=${color}:x=${tx}:y=${ty}[${out}]`
      );
      videoLabel = out;
    }
  }

  filters.push(`[${videoLabel}]format=yuv420p[outv]`);

  let audioMapLabel;
  if (audioLabels.length === 0) {
    inputs.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=' + sampleRate);
    audioMapLabel = `${inputIndex}:a`;
  } else if (audioLabels.length === 1) {
    audioMapLabel = audioLabels[0];
  } else {
    filters.push(`${audioLabels.map(l => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest[outa]`);
    audioMapLabel = 'outa';
  }
  if (audioMapLabel !== 'outa' && !audioMapLabel.startsWith('outa')) {
    // normalize single/silent audio source into a final [outa] label too
    filters.push(`[${audioMapLabel}]anull[outa]`);
  }

  const { videoArgs } = buildVideoEncoderArgs(db.settings.output, { fpsNum });
  const audioArgs = buildAudioEncoderArgs(db.settings.output);

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[outv]', '-map', '[outa]',
    ...videoArgs,
    ...audioArgs,
    '-ar', String(sampleRate),
    '-ac', String(channels),
    '-r', fpsArg,
    '-f', 'tee',
    platforms.join('|')
  ];

  return { args, width: w, height: h };
}

function start(db) {
  if (proc) throw new Error('Stream already running.');
  const { args } = buildCommand(db);
  status = 'starting';
  lastError = null;
  logTail.length = 0;
  pushLog(`ffmpeg ${args.join(' ')}`);

  proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  startedAt = Date.now();

  proc.stdout.on('data', d => pushLog(d.toString()));
  proc.stderr.on('data', d => {
    const s = d.toString();
    pushLog(s);
    if (status === 'starting' && /frame=/.test(s)) status = 'live';
  });
  proc.on('error', err => {
    lastError = err.message;
    status = 'error';
    proc = null;
    startedAt = null;
  });
  proc.on('exit', (code, signal) => {
    if (status !== 'stopping') {
      status = code === 0 ? 'idle' : 'error';
      if (code !== 0) lastError = `ffmpeg exited with code ${code} (signal ${signal || 'none'})`;
    } else {
      status = 'idle';
    }
    proc = null;
    startedAt = null;
  });

  // Optimistically flip to live shortly after start if ffmpeg hasn't errored.
  setTimeout(() => { if (proc && status === 'starting') status = 'live'; }, 3000);
}

function stop() {
  if (!proc) { status = 'idle'; return; }
  status = 'stopping';
  proc.kill('SIGINT');
  setTimeout(() => { if (proc) proc.kill('SIGKILL'); }, 5000);
}

function getStatus() {
  return {
    status,
    uptimeSeconds: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
    lastError,
    log: logTail.slice(-50)
  };
}

module.exports = { start, stop, getStatus, buildCommand, SERVICE_DEFAULT_SERVER };
