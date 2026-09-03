/**
 * Maps the UI-facing encoder names to ffmpeg codec names, and declares
 * which Rate Control / Keyframe Interval / Preset / Profile / Tune
 * options are valid for each encoder. The Output Settings UI calls
 * GET /api/settings/output/capabilities to fetch this table and only
 * renders the options that apply to the currently selected encoder.
 */

const PRESETS_X26X = ['Ultra Fast', 'Super Fast', 'Very Fast', 'Faster', 'Fast', 'Medium', 'Slow', 'Slower', 'Very Slow', 'Placebo'];
const PROFILES_H264 = ['Baseline', 'Main', 'High'];
const PROFILES_H265 = ['Main', 'High 10'];
const TUNE_X264 = ['Zero latency', 'Film', 'Animation', 'Grain', 'Still image', 'PSNR', 'SSIM', 'Fast decode'];
const TUNE_X265 = ['Zero latency', 'Grain', 'PSNR', 'SSIM', 'Fast decode'];

const VIDEO_ENCODERS = {
  'H.264': {
    codec: 'libx264',
    rateControl: ['CBR', 'VBR', 'CRF', 'VBV', 'None'],
    keyframeInterval: true,
    preset: [...PRESETS_X26X, 'None'],
    profile: [...PROFILES_H264, 'None'],
    tune: [...TUNE_X264, 'None']
  },
  'H.265': {
    codec: 'libx265',
    rateControl: ['CBR', 'VBR', 'CRF', 'VBV', 'None'],
    keyframeInterval: true,
    preset: [...PRESETS_X26X, 'None'],
    profile: [...PROFILES_H265, 'None'],
    tune: [...TUNE_X265, 'None']
  },
  'VP9': {
    codec: 'libvpx-vp9',
    rateControl: ['CBR', 'VBR', 'CQ', 'None'],
    keyframeInterval: true,
    preset: ['None'],
    profile: ['None'],
    tune: ['None']
  },
  'AV1': {
    codec: 'libaom-av1',
    rateControl: ['CBR', 'VBR', 'CRF', 'CQ', 'None'],
    keyframeInterval: true,
    preset: [...PRESETS_X26X, 'None'],
    profile: ['Main', 'None'],
    tune: ['None']
  },
  'SVT AV1': {
    codec: 'libsvtav1',
    rateControl: ['CBR', 'VBR', 'CRF', 'None'],
    keyframeInterval: true,
    preset: [...PRESETS_X26X, 'None'],
    profile: ['Main', 'None'],
    tune: ['None']
  },
  'H.264 NVIDIA': {
    codec: 'h264_nvenc',
    rateControl: ['CBR', 'VBR', 'CQ', 'QP', 'None'],
    keyframeInterval: true,
    preset: ['Fast', 'Medium', 'Slow', 'None'],
    profile: [...PROFILES_H264, 'None'],
    tune: ['Zero latency', 'None']
  },
  'H.265 NVIDIA': {
    codec: 'hevc_nvenc',
    rateControl: ['CBR', 'VBR', 'CQ', 'QP', 'None'],
    keyframeInterval: true,
    preset: ['Fast', 'Medium', 'Slow', 'None'],
    profile: [...PROFILES_H265, 'None'],
    tune: ['Zero latency', 'None']
  },
  'AV1 NVIDIA': {
    codec: 'av1_nvenc',
    rateControl: ['CBR', 'VBR', 'CQ', 'None'],
    keyframeInterval: true,
    preset: ['Fast', 'Medium', 'Slow', 'None'],
    profile: ['Main', 'None'],
    tune: ['None']
  },
  'H.264 IQS': {
    codec: 'h264_qsv',
    rateControl: ['CBR', 'VBR', 'CQ', 'QP', 'None'],
    keyframeInterval: true,
    preset: [...PRESETS_X26X, 'None'],
    profile: [...PROFILES_H264, 'None'],
    tune: ['None']
  },
  'HEVC IQS': {
    codec: 'hevc_qsv',
    rateControl: ['CBR', 'VBR', 'CQ', 'QP', 'None'],
    keyframeInterval: true,
    preset: [...PRESETS_X26X, 'None'],
    profile: [...PROFILES_H265, 'None'],
    tune: ['None']
  },
  'AV1 IQS': {
    codec: 'av1_qsv',
    rateControl: ['CBR', 'VBR', 'CQ', 'None'],
    keyframeInterval: true,
    preset: [...PRESETS_X26X, 'None'],
    profile: ['Main', 'None'],
    tune: ['None']
  },
  'H.264 AMD': {
    codec: 'h264_amf',
    rateControl: ['CBR', 'VBR', 'CQ', 'QP', 'None'],
    keyframeInterval: true,
    preset: ['Fast', 'Medium', 'Slow', 'None'],
    profile: [...PROFILES_H264, 'None'],
    tune: ['None']
  },
  'HEVC AMD': {
    codec: 'hevc_amf',
    rateControl: ['CBR', 'VBR', 'CQ', 'QP', 'None'],
    keyframeInterval: true,
    preset: ['Fast', 'Medium', 'Slow', 'None'],
    profile: [...PROFILES_H265, 'None'],
    tune: ['None']
  },
  'MPEG-4': {
    codec: 'mpeg4',
    rateControl: ['CBR', 'VBR', 'None'],
    keyframeInterval: true,
    preset: ['None'],
    profile: ['None'],
    tune: ['None']
  },
  'MPEG-2': {
    codec: 'mpeg2video',
    rateControl: ['CBR', 'VBR', 'None'],
    keyframeInterval: true,
    preset: ['None'],
    profile: ['None'],
    tune: ['None']
  },
  'None': {
    codec: 'copy',
    rateControl: ['None'],
    keyframeInterval: false,
    preset: ['None'],
    profile: ['None'],
    tune: ['None']
  }
};

const AUDIO_ENCODERS = {
  'AAC': 'aac',
  'Opus': 'libopus',
  'MP3': 'libmp3lame',
  'AC-3': 'ac3',
  'EAC-3': 'eac3',
  'FLAC': 'flac',
  'PCM 16': 'pcm_s16le',
  'None': 'copy'
};

function listVideoEncoders() {
  return Object.keys(VIDEO_ENCODERS);
}

function listAudioEncoders() {
  return Object.keys(AUDIO_ENCODERS);
}

function getVideoEncoderInfo(name) {
  return VIDEO_ENCODERS[name] || VIDEO_ENCODERS['H.264'];
}

function getAudioCodec(name) {
  return AUDIO_ENCODERS[name] || 'aac';
}

module.exports = {
  VIDEO_ENCODERS,
  AUDIO_ENCODERS,
  listVideoEncoders,
  listAudioEncoders,
  getVideoEncoderInfo,
  getAudioCodec
};
