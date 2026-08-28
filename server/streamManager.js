const { spawn } = require('child_process');
const os = require('os');
const { EventEmitter } = require('events');
const { VIDEO_ENCODERS, AUDIO_ENCODERS, PRESET_FLAG } = require('./ffmpegMaps');

class StreamManager extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.startedAt = null;
    this.status = 'offline'; // offline | starting | live | error
    this.lastError = null;
    this.stats = { uptime: 0, bitrate: 0, fps: 0, cpu: 0, ram: 0, status: 'offline' };
    this._statsTimer = null;
    this._lastCpu = process.cpuUsage();
  }

  isLive() { return this.status === 'live' || this.status === 'starting'; }

  buildArgs(settings, platforms) {
    const enabled = platforms.filter(p => p.enabled && p.server && p.key);
    if (enabled.length === 0) throw new Error('No enabled platform has a server/key configured.');

    const out = settings.output;
    const advVideo = out.advanced.video, advAudio = out.advanced.audio;
    const useAdvanced = out.mode === 'Advanced';

    const vEncKey = useAdvanced ? advVideo.encoder : out.simple.videoEncoder;
    const aEncKey = useAdvanced ? advAudio.encoder : out.simple.audioEncoder;
    const vEnc = VIDEO_ENCODERS[vEncKey] || VIDEO_ENCODERS['H.264'];
    const aEnc = AUDIO_ENCODERS[aEncKey] || AUDIO_ENCODERS['AAC'];
    const vBitrate = useAdvanced ? advVideo.bitrate : out.simple.videoBitrate;
    const aBitrate = useAdvanced ? advAudio.bitrate : out.simple.audioBitrate;
    const presetKey = useAdvanced ? advVideo.preset : out.simple.preset;
    const rateControl = useAdvanced ? advVideo.rateControl : 'CBR';

    const fps = settings.video.fps;
    const [ow, oh] = settings.video.outputResolution === 'Custom'
      ? [settings.video.outputCustom.width, settings.video.outputCustom.height]
      : settings.video.outputResolution.split('x').map(Number);

    const args = ['-hide_banner', '-loglevel', 'info', '-stats'];
    // input: raw chunks piped from the browser's MediaRecorder (webm/vp9+opus)
    args.push('-f', 'webm', '-i', 'pipe:0');

    args.push('-vf', `scale=${ow}:${oh}`, '-r', String(fps));

    if (vEnc.ffmpeg === 'copy') {
      args.push('-c:v', 'copy');
    } else {
      args.push('-c:v', vEnc.ffmpeg);
      if (rateControl === 'CRF' && vEnc.rateControl.includes('CRF')) {
        args.push('-crf', '23');
      } else if (rateControl !== 'None') {
        args.push('-b:v', `${vBitrate}k`);
        if (rateControl === 'CBR') args.push('-minrate', `${vBitrate}k`, '-maxrate', `${vBitrate}k`, '-bufsize', `${vBitrate * 2}k`);
        if (rateControl === 'VBV') args.push('-maxrate', `${vBitrate}k`, '-bufsize', `${vBitrate * 2}k`);
      }
      if (PRESET_FLAG[presetKey] && vEnc.ffmpeg.startsWith('lib')) args.push('-preset', PRESET_FLAG[presetKey]);
      args.push('-g', String(Math.round(fps * (useAdvanced ? advVideo.keyframeInterval : 2))));
      if (vEnc.ffmpeg === 'libx264' || vEnc.ffmpeg === 'libx265') args.push('-pix_fmt', 'yuv420p');
    }

    if (aEnc === 'copy') {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', aEnc, '-b:a', `${aBitrate}k`,
        '-ar', settings.audio.sampleRate.startsWith('44') ? '44100' : '48000',
        '-ac', settings.audio.channels === 'Mono' ? '1' : settings.audio.channels === 'Stereo' ? '2' : settings.audio.channels === '5.1 surround' ? '6' : '8');
    }

    // Multiple RTMP outputs via the "tee" muxer so we encode once and fan out.
    if (enabled.length === 1) {
      const p = enabled[0];
      args.push('-f', 'flv', this._url(p));
    } else {
      const targets = enabled.map(p => `[f=flv]${this._url(p)}`).join('|');
      args.push('-f', 'tee', targets);
    }

    return args;
  }

  _url(platform) {
    const server = platform.server.replace(/\/$/, '');
    return `${server}/${platform.key}`;
  }

  start(settings, platforms) {
    if (this.isLive()) throw new Error('Stream already running.');
    const args = this.buildArgs(settings, platforms);
    this.status = 'starting';
    this.lastError = null;
    this.emit('status', this.status);

    this.proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.startedAt = Date.now();

    this.proc.stderr.on('data', (chunk) => {
      const line = chunk.toString();
      this._parseProgress(line);
      if (this.status === 'starting' && /Opening|Stream mapping|frame=/.test(line)) {
        this.status = 'live';
        this.emit('status', this.status);
      }
    });

    this.proc.on('error', (err) => {
      this.lastError = err.message;
      this.status = 'error';
      this.emit('status', this.status);
    });

    this.proc.on('exit', (code) => {
      this.status = code === 0 ? 'offline' : 'error';
      if (code !== 0 && !this.lastError) this.lastError = `ffmpeg exited with code ${code}`;
      this.proc = null;
      this.startedAt = null;
      this.emit('status', this.status);
    });

    this._startStatsLoop();
    return { ok: true };
  }

  stop() {
    if (this.proc) {
      try { this.proc.stdin.end(); } catch (e) {}
      this.proc.kill('SIGINT');
    }
    this.status = 'offline';
    this.startedAt = null;
    this.emit('status', this.status);
  }

  // Feed a raw media chunk (Buffer) from the browser's MediaRecorder into ffmpeg stdin.
  feed(buffer) {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(buffer);
    }
  }

  _parseProgress(line) {
    const fpsMatch = line.match(/fps=\s*([\d.]+)/);
    const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/);
    if (fpsMatch) this.stats.fps = parseFloat(fpsMatch[1]);
    if (bitrateMatch) this.stats.bitrate = parseFloat(bitrateMatch[1]);
  }

  _startStatsLoop() {
    if (this._statsTimer) clearInterval(this._statsTimer);
    this._statsTimer = setInterval(() => {
      this.stats.uptime = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
      this.stats.status = this.status;
      const cpus = os.cpus();
      let idle = 0, total = 0;
      cpus.forEach(c => { for (const t in c.times) total += c.times[t]; idle += c.times.idle; });
      this.stats.cpu = Math.round(100 * (1 - idle / total));
      this.stats.ram = Math.round(100 * (1 - os.freemem() / os.totalmem()));
      this.emit('stats', this.stats);
      if (this.status === 'offline' && !this.proc) clearInterval(this._statsTimer);
    }, 1000);
  }

  getStats() {
    this.stats.status = this.status;
    this.stats.uptime = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
    return this.stats;
  }
}

module.exports = new StreamManager();
