'use strict';

/**
 * Encoder capability matrix.
 *
 * Each entry describes:
 *  - ffmpeg: the real ffmpeg -c:v value
 *  - kind: 'software' | 'nvenc' | 'qsv' | 'amf' | 'copy' | 'legacy'
 *  - rateControl: list of rate-control modes this encoder exposes in the UI
 *  - keyframeInterval: whether a keyframe interval (GOP) control applies
 *  - presets / profiles / tunes: allowed lists (empty array = not offered)
 *
 * Hardware encoders (NVIDIA / IQS (Intel QuickSync) / AMD) are exposed in the
 * UI exactly as requested, but they only actually run if the host machine has
 * the matching GPU + drivers + an ffmpeg build with that hwaccel compiled in.
 * If a hardware encoder isn't available at runtime, the engine reports a
 * clear error instead of silently falling back, so the operator always knows
 * why a stream failed to start.
 */

const RATE_CONTROL = {
  CBR: 'CBR', VBR: 'VBR', CRF: 'CRF', QP: 'QP', CQ: 'CQ', ABR: 'ABR', VBV: 'VBV', NONE: 'None'
};

const PRESETS_X264_X265 = ['Ultra Fast', 'Super Fast', 'Very Fast', 'Faster', 'Fast', 'Medium', 'Slow', 'Slower', 'Very Slow', 'Placebo'];
const PRESET_MAP_X264_X265 = {
  'Ultra Fast': 'ultrafast', 'Super Fast': 'superfast', 'Very Fast': 'veryfast', 'Faster': 'faster',
  'Fast': 'fast', 'Medium': 'medium', 'Slow': 'slow', 'Slower': 'slower', 'Very Slow': 'veryslow', 'Placebo': 'placebo'
};

const PROFILES_H264 = ['Baseline', 'Main', 'High'];
const PROFILES_H265 = ['Main', 'High'];

const TUNES_X264 = ['Zero latency', 'Film', 'Animation', 'Grain', 'Still image', 'PSNR', 'SSIM', 'Fast decode'];
const TUNE_MAP_X264 = {
  'Zero latency': 'zerolatency', 'Film': 'film', 'Animation': 'animation', 'Grain': 'grain',
  'Still image': 'stillimage', 'PSNR': 'psnr', 'SSIM': 'ssim', 'Fast decode': 'fastdecode'
};
const TUNES_X265 = ['Grain', 'PSNR', 'SSIM', 'Fast decode', 'Zero latency', 'Animation'];
const TUNE_MAP_X265 = {
  'Grain': 'grain', 'PSNR': 'psnr', 'SSIM': 'ssim', 'Fast decode': 'fastdecode',
  'Zero latency': 'zerolatency', 'Animation': 'animation'
};

const NVENC_PRESETS = ['Fast', 'Medium', 'Slow'];
const NVENC_PRESET_MAP = { Fast: 'p1', Medium: 'p4', Slow: 'p7' };

const QSV_PRESETS = ['Very Fast', 'Faster', 'Fast', 'Medium', 'Slow', 'Slower', 'Very Slow'];
const QSV_PRESET_MAP = {
  'Very Fast': 'veryfast', 'Faster': 'faster', 'Fast': 'fast', 'Medium': 'medium',
  'Slow': 'slow', 'Slower': 'slower', 'Very Slow': 'veryslow'
};

const AMF_PRESETS = ['Fast', 'Medium', 'Slow'];
const AMF_PRESET_MAP = { Fast: 'speed', Medium: 'balanced', Slow: 'quality' };

const ENCODERS = {
  'H.264': {
    ffmpeg: 'libx264', kind: 'software',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CRF, RATE_CONTROL.VBV],
    keyframeInterval: true, presets: PRESETS_X264_X265, presetMap: PRESET_MAP_X264_X265,
    profiles: PROFILES_H264, tunes: TUNES_X264, tuneMap: TUNE_MAP_X264
  },
  'H.265': {
    ffmpeg: 'libx265', kind: 'software',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CRF, RATE_CONTROL.VBV],
    keyframeInterval: true, presets: PRESETS_X264_X265, presetMap: PRESET_MAP_X264_X265,
    profiles: PROFILES_H265, tunes: TUNES_X265, tuneMap: TUNE_MAP_X265
  },
  'VP9': {
    ffmpeg: 'libvpx-vp9', kind: 'software',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: [], profiles: [], tunes: []
  },
  'AV1': {
    ffmpeg: 'libaom-av1', kind: 'software',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CRF, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: [], profiles: [], tunes: []
  },
  'SVT AV1': {
    ffmpeg: 'libsvtav1', kind: 'software',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CRF],
    keyframeInterval: true,
    presets: ['Fast', 'Medium', 'Slow', 'Very Slow'],
    presetMap: { Fast: '8', Medium: '5', Slow: '3', 'Very Slow': '1' },
    profiles: [], tunes: []
  },
  'H.264 NVIDIA': {
    ffmpeg: 'h264_nvenc', kind: 'nvenc',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: NVENC_PRESETS, presetMap: NVENC_PRESET_MAP,
    profiles: PROFILES_H264, tunes: []
  },
  'H.265 NVIDIA': {
    ffmpeg: 'hevc_nvenc', kind: 'nvenc',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: NVENC_PRESETS, presetMap: NVENC_PRESET_MAP,
    profiles: PROFILES_H265, tunes: []
  },
  'AV1 NVIDIA': {
    ffmpeg: 'av1_nvenc', kind: 'nvenc',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: NVENC_PRESETS, presetMap: NVENC_PRESET_MAP,
    profiles: [], tunes: []
  },
  'H.264 IQS': {
    ffmpeg: 'h264_qsv', kind: 'qsv',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: QSV_PRESETS, presetMap: QSV_PRESET_MAP,
    profiles: PROFILES_H264, tunes: []
  },
  'HEVC IQS': {
    ffmpeg: 'hevc_qsv', kind: 'qsv',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: QSV_PRESETS, presetMap: QSV_PRESET_MAP,
    profiles: PROFILES_H265, tunes: []
  },
  'AV1 IQS': {
    ffmpeg: 'av1_qsv', kind: 'qsv',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: QSV_PRESETS, presetMap: QSV_PRESET_MAP,
    profiles: [], tunes: []
  },
  'H.264 AMD': {
    ffmpeg: 'h264_amf', kind: 'amf',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: AMF_PRESETS, presetMap: AMF_PRESET_MAP,
    profiles: PROFILES_H264, tunes: []
  },
  'HEVC AMD': {
    ffmpeg: 'hevc_amf', kind: 'amf',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.CQ],
    keyframeInterval: true, presets: AMF_PRESETS, presetMap: AMF_PRESET_MAP,
    profiles: PROFILES_H265, tunes: []
  },
  'MPEG-4': {
    ffmpeg: 'mpeg4', kind: 'legacy',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.QP],
    keyframeInterval: true, presets: [], profiles: [], tunes: []
  },
  'MPEG-2': {
    ffmpeg: 'mpeg2video', kind: 'legacy',
    rateControl: [RATE_CONTROL.CBR, RATE_CONTROL.VBR, RATE_CONTROL.QP],
    keyframeInterval: true, presets: [], profiles: [], tunes: []
  },
  'None': {
    ffmpeg: 'copy', kind: 'copy',
    rateControl: [RATE_CONTROL.NONE], keyframeInterval: false, presets: [], profiles: [], tunes: []
  }
};

const AUDIO_ENCODERS = {
  AAC: 'aac',
  Opus: 'libopus',
  MP3: 'libmp3lame',
  'AC-3': 'ac3',
  'EAC-3': 'eac3',
  FLAC: 'flac',
  'PCM 16': 'pcm_s16le',
  None: 'copy'
};

function listVideoEncoders() {
  return Object.keys(ENCODERS);
}

function listAudioEncoders() {
  return Object.keys(AUDIO_ENCODERS);
}

function getVideoEncoder(name) {
  const e = ENCODERS[name];
  if (!e) throw new Error(`Unknown video encoder "${name}"`);
  return e;
}

function getAudioEncoder(name) {
  const e = AUDIO_ENCODERS[name];
  if (!e) throw new Error(`Unknown audio encoder "${name}"`);
  return e;
}

module.exports = { ENCODERS, AUDIO_ENCODERS, listVideoEncoders, listAudioEncoders, getVideoEncoder, getAudioEncoder };
