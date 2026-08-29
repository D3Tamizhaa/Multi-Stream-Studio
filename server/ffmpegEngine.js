'use strict';

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const encoderProfiles = require('./encoderProfiles');

const RES_PRESETS = {
  '1920x1080': [1920, 1080], '1280x720': [1280, 720], '852x480': [852, 480], '640x360': [640, 360]
};

function resolveResolution(setting, custom) {
  if (setting === 'Custom' && custom) return [custom.width, custom.height];
  return RES_PRESETS[setting] || RES_PRESETS['1920x1080'];
}

function ffmpegColorForCss(color) {
  // Accepts #RRGGBB, #RRGGBBAA, or rgba(r,g,b,a) and returns ffmpeg drawtext color syntax.
  if (!color) return 'white';
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 8) {
      const rgb = hex.slice(0, 6);
      const alpha = parseInt(hex.slice(6, 8), 16) / 255;
      return `0x${rgb}@${alpha.toFixed(3)}`;
    }
    return `0x${hex}`;
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => s.trim());
    const [r, g, b] = parts;
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    const hex = [r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
    return `0x${hex}@${a}`;
  }
  return color; // named color, hope for the best
}

function escapeDrawtext(text) {
  return String(text)
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '\u2019');
}

/** Builds the ffmpeg -c:v ... args for a given encoder + rate-control configuration. */
function buildVideoEncodeArgs(encoderName, cfg, fps) {
  const enc = encoderProfiles.getVideoEncoder(encoderName);
  const args = ['-c:v', enc.ffmpeg];
  if (enc.kind === 'copy') return args;

  const rc = cfg.rateControl || enc.rateControl[0];
  const bitrateK = Number(cfg.bitrate || 2500);
  const quality = Number(cfg.quality != null ? cfg.quality : 23);

  if (enc.kind === 'software' && (enc.ffmpeg === 'libx264' || enc.ffmpeg === 'libx265')) {
    if (rc === 'CBR') {
      args.push('-b:v', `${bitrateK}k`, '-minrate', `${bitrateK}k`, '-maxrate', `${bitrateK}k`, '-bufsize', `${bitrateK * 2}k`);
    } else if (rc === 'VBR') {
      args.push('-b:v', `${bitrateK}k`, '-maxrate', `${Math.round(bitrateK * 1.5)}k`, '-bufsize', `${bitrateK * 2}k`);
    } else if (rc === 'VBV') {
      args.push('-b:v', `${bitrateK}k`, '-maxrate', `${bitrateK}k`, '-bufsize', `${Math.round(bitrateK * 1.5)}k`);
    } else if (rc === 'CRF') {
      args.push('-crf', String(quality));
    }
    if (cfg.preset && enc.presetMap && enc.presetMap[cfg.preset]) args.push('-preset', enc.presetMap[cfg.preset]);
    if (cfg.profile && cfg.profile !== 'None' && enc.profiles.includes(cfg.profile)) {
      args.push('-profile:v', cfg.profile.toLowerCase().replace(/\s+/g, ''));
    }
    if (cfg.tune && cfg.tune !== 'None' && enc.tuneMap && enc.tuneMap[cfg.tune]) args.push('-tune', enc.tuneMap[cfg.tune]);
    if (rc === 'CBR' && enc.ffmpeg === 'libx264') args.push('-x264-params', 'nal-hrd=cbr:force-cfr=1');
  } else if (enc.kind === 'software' && (enc.ffmpeg === 'libvpx-vp9' || enc.ffmpeg === 'libaom-av1' || enc.ffmpeg === 'libsvtav1')) {
    if (rc === 'CQ' || rc === 'CRF') {
      args.push('-crf', String(quality), '-b:v', '0');
    } else {
      args.push('-b:v', `${bitrateK}k`);
      if (rc === 'CBR') args.push('-minrate', `${bitrateK}k`, '-maxrate', `${bitrateK}k`);
      if (rc === 'VBR') args.push('-maxrate', `${Math.round(bitrateK * 1.5)}k`);
    }
    if (enc.ffmpeg === 'libsvtav1' && cfg.preset && enc.presetMap[cfg.preset]) args.push('-preset', enc.presetMap[cfg.preset]);
    if (enc.ffmpeg !== 'libsvtav1') args.push('-deadline', 'realtime', '-cpu-used', '5');
  } else if (enc.kind === 'nvenc') {
    const rcMap = { CBR: 'cbr', VBR: 'vbr', CQ: 'constqp' };
    args.push('-rc', rcMap[rc] || 'vbr');
    if (rc === 'CQ') args.push('-qp', String(quality));
    else args.push('-b:v', `${bitrateK}k`, '-maxrate', `${bitrateK}k`, '-bufsize', `${bitrateK * 2}k`);
    if (cfg.preset && enc.presetMap[cfg.preset]) args.push('-preset', enc.presetMap[cfg.preset]);
    if (cfg.profile && cfg.profile !== 'None' && enc.profiles.includes(cfg.profile)) args.push('-profile:v', cfg.profile.toLowerCase());
  } else if (enc.kind === 'qsv') {
    if (rc === 'CQ') args.push('-global_quality', String(quality), '-look_ahead', '0');
    else args.push('-b:v', `${bitrateK}k`, '-maxrate', `${bitrateK}k`);
    if (cfg.preset && enc.presetMap[cfg.preset]) args.push('-preset', enc.presetMap[cfg.preset]);
    if (cfg.profile && cfg.profile !== 'None' && enc.profiles.includes(cfg.profile)) args.push('-profile:v', cfg.profile.toLowerCase());
  } else if (enc.kind === 'amf') {
    const rcMap = { CBR: 'cbr', VBR: 'vbr_peak', CQ: 'cqp' };
    args.push('-rc', rcMap[rc] || 'vbr_peak');
    if (rc === 'CQ') args.push('-qp_i', String(quality), '-qp_p', String(quality), '-qp_b', String(quality));
    else args.push('-b:v', `${bitrateK}k`, '-maxrate', `${bitrateK}k`);
    if (cfg.preset && enc.presetMap[cfg.preset]) args.push('-quality', enc.presetMap[cfg.preset]);
    if (cfg.profile && cfg.profile !== 'None' && enc.profiles.includes(cfg.profile)) args.push('-profile:v', cfg.profile.toLowerCase());
  } else if (enc.kind === 'legacy') {
    args.push('-b:v', `${bitrateK}k`);
    if (rc === 'QP') args.push('-qscale:v', String(Math.max(1, Math.round(quality / 3))));
  }

  if (enc.keyframeInterval && cfg.keyframeIntervalSec) {
    const g = Math.max(1, Math.round(Number(cfg.keyframeIntervalSec) * fps));
    args.push('-g', String(g), '-keyint_min', String(g));
  }
  return args.filter((a) => a !== '');
}

function buildAudioEncodeArgs(encoderName, bitrateK, sampleRate, channels) {
  const enc = encoderProfiles.getAudioEncoder(encoderName);
  if (enc === 'copy') return ['-c:a', 'copy'];
  const args = ['-c:a', enc];
  if (enc !== 'pcm_s16le' && enc !== 'flac') args.push('-b:a', `${bitrateK}k`);
  const sr = sampleRate === '44.1 kHz' ? 44100 : 48000;
  args.push('-ar', String(sr));
  const chMap = { Mono: 1, Stereo: 2, '5.1 surround': 6, '7.1 surround': 8 };
  args.push('-ac', String(chMap[channels] || 2));
  return args;
}

function platformIngestUrl(platform) {
  const service = platform.service;
  const key = platform.streamKey || '';
  if (service === 'YouTube') return `rtmp://a.rtmp.youtube.com/live2/${key}`;
  if (service === 'Facebook') return `rtmps://live-api-s.facebook.com:443/rtmp/${key}`;
  if (service === 'Twitch') return `rtmp://live.twitch.tv/app/${key}`;
  if (service === 'Kick') return `rtmp://fa723fc1b171.global-contribute.live-video.net/live/${key}`;
  if (service === 'RTMP') return `${(platform.server || '').replace(/\/+$/, '')}/${key}`;
  throw new Error(`Unknown service "${service}"`);
}

class FfmpegEngine extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.startedAt = null;
    this.stats = { uptimeSec: 0, bitrateKbps: 0, fps: 0, cpuPercent: 0, ramPercent: 0, status: 'idle' };
    this._statsTimer = null;
    this._lastLog = [];
  }

  isLive() {
    return !!this.proc;
  }

  /**
   * Builds the composited scene graph: the ffmpeg -i input args, the [vout] video filter
   * chain, and (when includeAudio) the [aout] audio mix. Shared by the live encoder and the
   * still-frame workspace preview so both always render identically.
   *
   * Real ffmpeg -i inputs are only ever image/media sources — the base canvas is a synthetic
   * `color=` lavfi source generated purely inside -filter_complex, so it does NOT consume an
   * input index. Input indices therefore start at 0 for the first image/media source.
   */
  buildGraph({ scene, settings, uploadsDir, forPreview, includeAudio }) {
    const [outW, outH] = resolveResolution(settings.video.outputResolution, settings.video.outputCustom);
    const [baseW, baseH] = resolveResolution(settings.video.baseResolution, settings.video.baseCustom);
    const fps = Number(settings.video.fps) || 30;

    const visibleSources = (scene.sources || [])
      .filter((s) => s.shown !== false)
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    const inputArgs = [];
    let inputIndex = 0;
    const overlaySources = []; // { idx, source } — image + media, in z-order
    const audioCandidates = []; // { idx, source } — media only

    for (const src of visibleSources) {
      if (src.type === 'image') {
        inputArgs.push('-loop', '1', '-framerate', String(fps), '-i', path.join(uploadsDir, 'images', src.file));
        overlaySources.push({ idx: inputIndex, source: src });
        inputIndex += 1;
      } else if (src.type === 'media') {
        if (forPreview) {
          inputArgs.push('-i', path.join(uploadsDir, 'media', src.file));
        } else {
          if (src.loop) inputArgs.push('-stream_loop', '-1');
          inputArgs.push('-re', '-i', path.join(uploadsDir, 'media', src.file));
        }
        overlaySources.push({ idx: inputIndex, source: src });
        if (src.hasAudio !== false && (src.monitor || 'Monitor and Output') !== 'Monitor Only') {
          audioCandidates.push({ idx: inputIndex, source: src });
        }
        inputIndex += 1;
      }
      // text sources need no ffmpeg input; they're pure drawtext filters below
    }

    // --- video chain ---
    const filterParts = [];
    filterParts.push(`color=c=black:s=${baseW}x${baseH}:r=${fps}[base0]`);
    let cur = 'base0';
    let stageN = 0;
    for (const { idx, source } of overlaySources) {
      const scaled = `sc${stageN}`;
      const w = Math.max(1, Math.round(source.width || 320));
      const h = Math.max(1, Math.round(source.height || 180));
      filterParts.push(`[${idx}:v]scale=${w}:${h}[${scaled}]`);
      const next = `v${stageN}`;
      const x = Math.round(source.x || 0);
      const y = Math.round(source.y || 0);
      filterParts.push(`[${cur}][${scaled}]overlay=${x}:${y}:shortest=0[${next}]`);
      cur = next;
      stageN += 1;
    }
    const textSources = visibleSources.filter((s) => s.type === 'text');
    for (const t of textSources) {
      const next = `t${stageN}`;
      const fontsize = Math.max(1, Math.round(t.fontSize || 32));
      const color = ffmpegColorForCss(t.color || '#FFFFFF');
      const x = Math.round(t.x || 0);
      const y = Math.round(t.y || 0);
      const fontArg = t.fontFile
        ? `:fontfile='${path.join(uploadsDir, 'fonts', t.fontFile)}'`
        : `:font='${(t.fontFamily || 'DejaVu Sans').replace(/'/g, '')}'`;
      filterParts.push(
        `[${cur}]drawtext=text='${escapeDrawtext(t.text || '')}'${fontArg}:fontsize=${fontsize}:fontcolor=${color}:x=${x}:y=${y}[${next}]`
      );
      cur = next;
      stageN += 1;
    }
    filterParts.push(`[${cur}]scale=${outW}:${outH},format=yuv420p[vout]`);

    // --- audio chain (only for the live encode, not the still preview) ---
    if (includeAudio) {
      if (audioCandidates.length === 0) {
        filterParts.push('anullsrc=channel_layout=stereo:sample_rate=48000[aout]');
      } else {
        const labels = [];
        audioCandidates.forEach((a, i) => {
          const vol = a.source.muted ? 0 : Math.max(0, Number(a.source.volume != null ? a.source.volume : 100) / 100);
          filterParts.push(`[${a.idx}:a]volume=${vol}[a${i}]`);
          labels.push(`[a${i}]`);
        });
        if (labels.length === 1) {
          filterParts.push(`${labels[0]}anull[aout]`);
        } else {
          filterParts.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=2[aout]`);
        }
      }
    }

    return { inputArgs, filterComplex: filterParts.join(';'), fps, outW, outH };
  }

  /** Renders a single JPEG snapshot of the composited scene using ffmpeg itself (not a faked preview). */
  renderPreviewFrame({ scene, settings, uploadsDir }) {
    return new Promise((resolve, reject) => {
      const { inputArgs, filterComplex } = this.buildGraph({ scene, settings, uploadsDir, forPreview: true, includeAudio: false });
      const args = [
        '-hide_banner', '-y', '-loglevel', 'error',
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-frames:v', '1',
        '-f', 'image2', '-vcodec', 'mjpeg',
        'pipe:1'
      ];
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks = [];
      let stderr = '';
      proc.stdout.on('data', (c) => chunks.push(c));
      proc.stderr.on('data', (c) => { stderr += c.toString(); });
      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
        else reject(new Error(stderr || `ffmpeg preview exited with code ${code}`));
      });
    });
  }

  /** Builds the full ffmpeg argument list for the given scene + settings + enabled platforms. */
  buildArgs({ scene, settings, platforms, uploadsDir }) {
    const { inputArgs, filterComplex, fps } = this.buildGraph({ scene, settings, uploadsDir, forPreview: false, includeAudio: true });

    const outMode = settings.output.mode;
    let videoCfg;
    let audioEncoderName;
    let audioBitrate;
    let videoEncoderName;
    if (outMode === 'Simple') {
      videoCfg = { rateControl: 'CBR', bitrate: settings.output.simple.videoBitrate, preset: settings.output.simple.preset };
      videoEncoderName = settings.output.simple.videoEncoder;
      audioEncoderName = settings.output.simple.audioEncoder;
      audioBitrate = settings.output.simple.audioBitrate;
    } else {
      const v = settings.output.advanced.video;
      videoCfg = {
        rateControl: v.rateControl, bitrate: v.bitrate, quality: v.quality,
        preset: v.preset, profile: v.profile, tune: v.tune, keyframeIntervalSec: v.keyframeInterval
      };
      videoEncoderName = v.encoder;
      audioEncoderName = settings.output.advanced.audio.encoder;
      audioBitrate = settings.output.advanced.audio.bitrate;
    }

    const videoEncodeArgs = buildVideoEncodeArgs(videoEncoderName, videoCfg, fps);
    const audioEncodeArgs = buildAudioEncodeArgs(audioEncoderName, audioBitrate, settings.audio.sampleRate, settings.audio.channels);

    const enabledPlatforms = (platforms || []).filter((p) => p.enabled);
    if (enabledPlatforms.length === 0) throw new Error('No enabled platforms to stream to.');
    const urls = enabledPlatforms.map((p) => `[f=flv]${platformIngestUrl(p)}`);
    const teeTarget = urls.join('|');

    return [
      '-hide_banner', '-y', '-loglevel', 'warning',
      '-progress', 'pipe:1', '-nostats',
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[vout]', '-map', '[aout]',
      ...videoEncodeArgs,
      ...audioEncodeArgs,
      '-r', String(fps),
      '-f', 'tee',
      teeTarget
    ];
  }

  start({ scene, settings, platforms, uploadsDir }) {
    if (this.proc) throw new Error('Already streaming.');
    const args = this.buildArgs({ scene, settings, platforms, uploadsDir });
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc = proc;
    this.startedAt = Date.now();
    this.stats.status = 'live';
    this._lastLog = [];

    let progressBuf = '';
    proc.stdout.on('data', (chunk) => {
      progressBuf += chunk.toString();
      const lines = progressBuf.split('\n');
      progressBuf = lines.pop();
      const kv = {};
      for (const line of lines) {
        const idx = line.indexOf('=');
        if (idx === -1) continue;
        kv[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
      if (kv.bitrate) {
        const m = /([\d.]+)\s*kbits\/s/.exec(kv.bitrate);
        if (m) this.stats.bitrateKbps = parseFloat(m[1]);
      }
      if (kv.fps) this.stats.fps = parseFloat(kv.fps) || 0;
      if (kv.progress === 'end') this._handleExit(0, null);
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      this._lastLog.push(text);
      if (this._lastLog.length > 200) this._lastLog.shift();
      this.emit('log', text);
    });

    proc.on('exit', (code, signal) => this._handleExit(code, signal));
    proc.on('error', (err) => {
      this.emit('log', `[engine] failed to start ffmpeg: ${err.message}\n`);
      this._handleExit(-1, null);
    });

    this._startStatsLoop();
    this.emit('started');
    return { pid: proc.pid, command: `ffmpeg ${args.map((a) => (/\s|\|/.test(a) ? `"${a}"` : a)).join(' ')}` };
  }

  stop() {
    if (!this.proc) return false;
    this.proc.kill('SIGINT');
    return true;
  }

  _handleExit(code, signal) {
    if (!this.proc) return;
    this.proc = null;
    this._stopStatsLoop();
    this.stats.status = code === 0 || signal === 'SIGINT' ? 'idle' : 'error';
    this.stats.bitrateKbps = 0;
    this.stats.fps = 0;
    this.startedAt = null;
    this.emit('stopped', { code, signal });
  }

  _startStatsLoop() {
    this._statsTimer = setInterval(async () => {
      if (!this.proc) return;
      this.stats.uptimeSec = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
      try {
        const pidusage = require('pidusage');
        const usage = await pidusage(this.proc.pid);
        const cpuCount = os.cpus().length || 1;
        this.stats.cpuPercent = Math.min(100, usage.cpu / cpuCount);
        this.stats.ramPercent = (usage.memory / os.totalmem()) * 100;
      } catch (e) {
        // process may have just exited between checks; ignore
      }
      this.emit('stats', this.getStats());
    }, 1000);
  }

  _stopStatsLoop() {
    if (this._statsTimer) clearInterval(this._statsTimer);
    this._statsTimer = null;
  }

  getStats() {
    return { ...this.stats };
  }

  getRecentLog() {
    return (this._lastLog || []).join('');
  }
}

module.exports = { FfmpegEngine, buildVideoEncodeArgs, buildAudioEncodeArgs, platformIngestUrl };
