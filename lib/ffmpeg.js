// lib/ffmpeg.js
// Core streaming engine: builds an FFmpeg filter_complex graph from the
// scene's sources (image / media / text) and pushes the composited output
// to one or more RTMP endpoints simultaneously via the `tee` muxer.
const { spawn } = require('child_process');
const path = require('path');

// ---------------------------------------------------------------------------
// Encoder capability map. The frontend calls GET /api/output/capabilities so
// it can show only the Rate Control / Preset / Profile / Tune options that a
// given encoder actually supports.
// ---------------------------------------------------------------------------
const VIDEO_ENCODERS = {
  'H.264':        { ffmpeg: 'libx264',     rateControl: ['CBR', 'VBR', 'CRF', 'VBV'],       preset: ['Ultra Fast','Super Fast','Very Fast','Faster','Fast','Medium','Slow','Slower','Very Slow','Placebo'], profile: ['Baseline','Main','High'], tune: ['Zero latency','Film','Animation','Grain','Still image','PSNR','SSIM','Fast decode'], keyframeInterval: true },
  'H.265':        { ffmpeg: 'libx265',     rateControl: ['CBR', 'VBR', 'CRF', 'VBV'],       preset: ['Ultra Fast','Super Fast','Very Fast','Faster','Fast','Medium','Slow','Slower','Very Slow','Placebo'], profile: ['Main','High','High 10'], tune: ['Zero latency','Grain','Fast decode','PSNR','SSIM'], keyframeInterval: true },
  'VP9':          { ffmpeg: 'libvpx-vp9',  rateControl: ['CBR', 'VBR', 'CRF', 'CQ'],        preset: ['Ultra Fast','Fast','Medium','Slow','Very Slow'], profile: [], tune: [], keyframeInterval: true },
  'AV1':          { ffmpeg: 'libaom-av1',  rateControl: ['CBR', 'VBR', 'CRF'],              preset: ['Very Fast','Fast','Medium','Slow','Very Slow'], profile: [], tune: [], keyframeInterval: true },
  'SVT AV1':      { ffmpeg: 'libsvtav1',   rateControl: ['CBR', 'VBR', 'CRF'],              preset: ['Ultra Fast','Very Fast','Faster','Fast','Medium','Slow','Very Slow'], profile: [], tune: [], keyframeInterval: true },
  'H.264 NVIDIA': { ffmpeg: 'h264_nvenc',  rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Fast','Medium','Slow'], profile: ['Baseline','Main','High'], tune: [], keyframeInterval: true },
  'H.265 NVIDIA': { ffmpeg: 'hevc_nvenc',  rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Fast','Medium','Slow'], profile: ['Main','High'], tune: [], keyframeInterval: true },
  'AV1 NVIDIA':   { ffmpeg: 'av1_nvenc',   rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Fast','Medium','Slow'], profile: [], tune: [], keyframeInterval: true },
  'H.264 IQS':    { ffmpeg: 'h264_qsv',    rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Very Fast','Fast','Medium','Slow','Very Slow'], profile: ['Baseline','Main','High'], tune: [], keyframeInterval: true },
  'HEVC IQS':     { ffmpeg: 'hevc_qsv',    rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Very Fast','Fast','Medium','Slow','Very Slow'], profile: ['Main','High'], tune: [], keyframeInterval: true },
  'AV1 IQS':      { ffmpeg: 'av1_qsv',     rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Very Fast','Fast','Medium','Slow','Very Slow'], profile: [], tune: [], keyframeInterval: true },
  'H.264 AMD':    { ffmpeg: 'h264_amf',    rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Fast','Medium','Slow'], profile: ['Baseline','Main','High'], tune: [], keyframeInterval: true },
  'HEVC AMD':     { ffmpeg: 'hevc_amf',    rateControl: ['CBR', 'VBR', 'CQ'],               preset: ['Fast','Medium','Slow'], profile: ['Main','High'], tune: [], keyframeInterval: true },
  'MPEG-4':       { ffmpeg: 'mpeg4',       rateControl: ['CBR', 'VBR', 'ABR'],              preset: [], profile: [], tune: [], keyframeInterval: true },
  'MPEG-2':       { ffmpeg: 'mpeg2video',  rateControl: ['CBR', 'VBR', 'ABR'],              preset: [], profile: [], tune: [], keyframeInterval: true },
  'None':         { ffmpeg: 'copy',        rateControl: ['None'],                            preset: [], profile: [], tune: [], keyframeInterval: false }
};

const AUDIO_ENCODERS = {
  'AAC':   { ffmpeg: 'aac' },
  'Opus':  { ffmpeg: 'libopus' },
  'MP3':   { ffmpeg: 'libmp3lame' },
  'AC-3':  { ffmpeg: 'ac3' },
  'EAC-3': { ffmpeg: 'eac3' },
  'FLAC':  { ffmpeg: 'flac' },
  'PCM 16':{ ffmpeg: 'pcm_s16le' },
  'None':  { ffmpeg: 'copy' }
};

const PRESET_MAP = {
  'Ultra Fast': 'ultrafast', 'Super Fast': 'superfast', 'Very Fast': 'veryfast',
  'Faster': 'faster', 'Fast': 'fast', 'Medium': 'medium', 'Slow': 'slow',
  'Slower': 'slower', 'Very Slow': 'veryslow', 'Placebo': 'placebo', 'None': null
};
const PROFILE_MAP = {
  'Baseline': 'baseline', 'Main': 'main', 'High': 'high',
  'High 10': 'high10', 'High 422': 'high422', 'High 444': 'high444', 'None': null
};
const TUNE_MAP = {
  'Zero latency': 'zerolatency', 'Film': 'film', 'Animation': 'animation',
  'Grain': 'grain', 'Still image': 'stillimage', 'PSNR': 'psnr', 'SSIM': 'ssim',
  'Fast decode': 'fastdecode', 'None': null
};

function capabilities() {
  return { videoEncoders: VIDEO_ENCODERS, audioEncoders: AUDIO_ENCODERS };
}

// ---------------------------------------------------------------------------
// Filter graph + argument builder
// ---------------------------------------------------------------------------
function escDrawtext(str) {
  // Order matters: escape backslashes first so we don't double-escape the
  // backslashes we insert while escaping quotes/colons/percent below.
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/:/g, '\\:');
}

function buildArgs({ scene, settings, uploadsDir, rtmpTargets }) {
  const W = getWidth(settings);
  const H = getHeight(settings);
  const FPS = settings.video.fps;
  const SR = settings.audio.sampleRate;
  const CH = { mono: 1, stereo: 2, '5.1 surround': 6, '7.1 surround': 8 }[settings.audio.channels] || 2;

  const args = ['-y', '-hide_banner', '-loglevel', 'info'];
  const inputs = [];
  let inputIndex = 0;

  // input 0: base canvas
  args.push('-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${FPS}`);
  inputIndex++;

  const visibleSources = (scene.sources || []).filter(s => s.visible !== false);
  const sourceInputIndex = {};
  const audioLabels = [];

  for (const src of visibleSources) {
    if (src.type === 'image') {
      args.push('-loop', '1', '-framerate', String(FPS), '-i', path.join(uploadsDir, src.file));
      sourceInputIndex[src.id] = inputIndex++;
    } else if (src.type === 'media') {
      if (src.loop) args.push('-stream_loop', '-1');
      args.push('-i', path.join(uploadsDir, src.file));
      sourceInputIndex[src.id] = inputIndex++;
    }
    // text sources need no input
  }

  // If nothing produces audio, feed silence so the output always has an audio track.
  // NOTE: "muted" only affects local monitoring in the browser preview, not the
  // outgoing stream (per spec: "Mute/Unmute - for local use only") -- so it's
  // intentionally ignored here.
  const hasAudioSource = visibleSources.some(s => s.type === 'media');
  let silenceIdx = null;
  if (!hasAudioSource) {
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=${CH === 1 ? 'mono' : 'stereo'}:sample_rate=${SR}`);
    silenceIdx = inputIndex++;
  }

  // Build filter_complex
  const filters = [];
  let cur = '[0:v]';
  let vLabelCount = 0;

  for (const src of visibleSources) {
    if (src.type === 'image' || (src.type === 'media' && hasVideoStream(src.file))) {
      const idx = sourceInputIndex[src.id];
      const scaled = `s${vLabelCount}`;
      filters.push(`[${idx}:v]scale=${Math.round(src.width)}:${Math.round(src.height)}[${scaled}]`);
      const next = `v${vLabelCount++}`;
      filters.push(`${cur}[${scaled}]overlay=${Math.round(src.x)}:${Math.round(src.y)}[${next}]`);
      cur = `[${next}]`;
    } else if (src.type === 'media') {
      // Audio-only media (e.g. .mp3) has no video stream to overlay -- it
      // still contributes to the audio mix below, just not the video chain.
    } else if (src.type === 'text') {
      const next = `v${vLabelCount++}`;
      const font = src.fontFamily ? `:font='${escDrawtext(src.fontFamily)}'` : '';
      filters.push(
        `${cur}drawtext=text='${escDrawtext(src.text)}':x=${Math.round(src.x)}:y=${Math.round(src.y)}` +
        `:fontsize=${src.fontSize || 32}:fontcolor=${src.color || '0xFFFFFF'}${font}[${next}]`
      );
      cur = `[${next}]`;
    }
  }
  filters.push(`${cur}format=yuv420p[vout]`);

  for (const src of visibleSources) {
    if (src.type === 'media') {
      const idx = sourceInputIndex[src.id];
      const vol = typeof src.volume === 'number' ? src.volume : 1;
      const lbl = `a${audioLabels.length}`;
      filters.push(`[${idx}:a]volume=${vol}[${lbl}]`);
      audioLabels.push(lbl);
    }
  }

  if (audioLabels.length === 0) {
    filters.push(`[${silenceIdx}:a]anull[aout]`);
  } else if (audioLabels.length === 1) {
    filters.push(`[${audioLabels[0]}]anull[aout]`);
  } else {
    filters.push(`${audioLabels.map(l => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:normalize=0[aout]`);
  }

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', '[vout]', '-map', '[aout]');

  // ---- Encoder settings ----
  const out = settings.output;
  let videoEnc, audioEnc, videoBitrate, audioBitrate, preset, profile, tune, rateControl, keyInt;

  if (out.mode === 'simple') {
    videoEnc = VIDEO_ENCODERS[out.simple.videoEncoder] || VIDEO_ENCODERS['H.264'];
    audioEnc = AUDIO_ENCODERS[out.simple.audioEncoder] || AUDIO_ENCODERS['AAC'];
    videoBitrate = out.simple.videoBitrate;
    audioBitrate = out.simple.audioBitrate;
    preset = PRESET_MAP[out.simple.preset] || 'veryfast';
    rateControl = 'CBR';
  } else {
    const v = out.advanced.video, a = out.advanced.audio;
    videoEnc = VIDEO_ENCODERS[v.encoder] || VIDEO_ENCODERS['H.264'];
    audioEnc = AUDIO_ENCODERS[a.encoder] || AUDIO_ENCODERS['AAC'];
    videoBitrate = v.bitrate;
    audioBitrate = a.bitrate;
    preset = PRESET_MAP[v.preset] || null;
    profile = PROFILE_MAP[v.profile] || null;
    tune = TUNE_MAP[v.tune] || null;
    rateControl = v.rateControl || 'CBR';
    keyInt = v.keyframeInterval;
  }

  if (videoEnc.ffmpeg === 'copy') {
    args.push('-c:v', 'copy');
  } else {
    args.push('-c:v', videoEnc.ffmpeg);
    if (preset && videoEnc.preset && videoEnc.preset.length) args.push('-preset', preset);
    if (profile && videoEnc.profile && videoEnc.profile.length) args.push('-profile:v', profile);
    if (tune && videoEnc.tune && videoEnc.tune.length) args.push('-tune', tune);
    if (rateControl === 'CRF') {
      args.push('-crf', '23');
    } else if (rateControl === 'QP' || rateControl === 'CQ' || rateControl === 'CQP') {
      args.push('-qp', '23');
    } else {
      args.push('-b:v', `${videoBitrate}k`);
      if (rateControl === 'CBR') args.push('-minrate', `${videoBitrate}k`, '-maxrate', `${videoBitrate}k`, '-bufsize', `${videoBitrate * 2}k`);
      if (rateControl === 'VBV' || rateControl === 'VBR') args.push('-maxrate', `${videoBitrate}k`, '-bufsize', `${videoBitrate * 2}k`);
    }
    if (keyInt) args.push('-g', String(Math.round((settings.video.fps || 30) * (keyInt || 2))));
  }

  if (audioEnc.ffmpeg === 'copy') {
    args.push('-c:a', 'copy');
  } else {
    args.push('-c:a', audioEnc.ffmpeg, '-b:a', `${audioBitrate}k`, '-ar', String(SR), '-ac', String(CH));
  }

  args.push('-f', 'tee');
  const teeTargets = rtmpTargets.map(t => `[f=flv:onfail=ignore]${t}`).join('|');
  args.push(teeTargets);

  return args;
}

function hasVideoStream(filename) {
  // .mp3 is audio-only; .mp4/.webm are treated as carrying video. Best-effort
  // by extension since we don't probe the file with ffprobe.
  return !/\.mp3$/i.test(filename || '');
}

function getWidth(settings) {
  if (settings.video.resolution === 'custom') return settings.video.customWidth;
  return parseInt(settings.video.resolution.split('x')[0], 10);
}
function getHeight(settings) {
  if (settings.video.resolution === 'custom') return settings.video.customHeight;
  return parseInt(settings.video.resolution.split('x')[1], 10);
}

// ---------------------------------------------------------------------------
// Process manager
// ---------------------------------------------------------------------------
class StreamEngine {
  constructor() {
    this.proc = null;
    this.startedAt = null;
    this.status = 'idle'; // idle | starting | live | error | reconnecting
    this.lastError = null;
    this.listeners = new Set();
  }

  onUpdate(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  snapshot() {
    return {
      status: this.status,
      uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
      lastError: this.lastError
    };
  }

  start({ scene, settings, uploadsDir, rtmpTargets, autoReconnect }) {
    if (this.proc) throw new Error('Stream already running');
    if (!rtmpTargets.length) throw new Error('No enabled platforms to stream to');

    const args = buildArgs({ scene, settings, uploadsDir, rtmpTargets });
    this.status = 'starting';
    this.lastError = null;
    this.emit();

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc = proc;
    this.startedAt = Date.now();

    let sawFrame = false;
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (/frame=\s*\d+/.test(text) && !sawFrame) {
        sawFrame = true;
        this.status = 'live';
        this.emit();
      }
      if (/Connection refused|Broken pipe|I\/O error|Error number/.test(text)) {
        this.lastError = text.trim().split('\n').pop();
      }
    });

    proc.on('exit', (code) => {
      const wasRunning = this.status === 'live' || this.status === 'starting';
      this.proc = null;
      if (code !== 0 && wasRunning && autoReconnect) {
        this.status = 'reconnecting';
        this.emit();
        setTimeout(() => {
          if (this.status === 'reconnecting') {
            try { this.start({ scene, settings, uploadsDir, rtmpTargets, autoReconnect }); }
            catch (e) { this.status = 'error'; this.lastError = e.message; this.emit(); }
          }
        }, 3000);
      } else {
        this.status = 'idle';
        this.startedAt = null;
        this.emit();
      }
    });

    return this.snapshot();
  }

  stop() {
    this._manualStop = true;
    if (this.proc) {
      this.proc.kill('SIGINT');
    }
    this.status = 'idle';
    this.startedAt = null;
    this.emit();
  }

  isRunning() {
    return !!this.proc;
  }
}

module.exports = { capabilities, buildArgs, StreamEngine, VIDEO_ENCODERS, AUDIO_ENCODERS };
