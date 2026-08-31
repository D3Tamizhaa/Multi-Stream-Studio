// Maps each Video/Audio "encoder" label (as shown in the UI) to:
//  - the real ffmpeg codec name
//  - which Rate Control / Preset / Profile / Tune options are actually valid for it
// The frontend calls GET /api/output/capabilities and filters dropdowns from this.

const PRESETS_X264_X265 = ['Ultra Fast', 'Super Fast', 'Very Fast', 'Faster', 'Fast', 'Medium', 'Slow', 'Slower', 'Very Slow', 'Placebo'];
const PRESETS_SPEED = ['Fast', 'Medium', 'Slow']; // generic hw/simple speed presets
const PRESETS_QSV = ['Very Fast', 'Faster', 'Fast', 'Medium', 'Slow', 'Slower', 'Very Slow'];

const VIDEO_ENCODERS = {
  'H.264': {
    ffmpeg: 'libx264',
    rateControl: ['CBR', 'VBR', 'CRF', 'VBV'],
    keyframeInterval: true,
    preset: PRESETS_X264_X265,
    profile: ['Baseline', 'Main', 'High'],
    tune: ['Zero latency', 'Film', 'Animation', 'Grain', 'Still image', 'PSNR', 'SSIM', 'Fast decode'],
  },
  'H.265': {
    ffmpeg: 'libx265',
    rateControl: ['CBR', 'VBR', 'CRF', 'VBV'],
    keyframeInterval: true,
    preset: PRESETS_X264_X265,
    profile: ['Main', 'High 10', 'High 422', 'High 444'],
    tune: ['Zero latency', 'Grain', 'PSNR', 'SSIM', 'Fast decode', 'Animation'],
  },
  'VP9': {
    ffmpeg: 'libvpx-vp9',
    rateControl: ['CBR', 'VBR', 'CQ'],
    keyframeInterval: true,
    preset: ['None'],
    profile: ['None'],
    tune: ['None'],
  },
  'AV1': {
    ffmpeg: 'libaom-av1',
    rateControl: ['CBR', 'VBR', 'CRF', 'CQ'],
    keyframeInterval: true,
    preset: ['None'],
    profile: ['None'],
    tune: ['None'],
  },
  'SVT AV1': {
    ffmpeg: 'libsvtav1',
    rateControl: ['CBR', 'VBR', 'CRF'],
    keyframeInterval: true,
    preset: ['Very Fast', 'Fast', 'Medium', 'Slow', 'Very Slow'],
    profile: ['Main', 'High'],
    tune: ['None', 'PSNR', 'SSIM'],
  },
  'H.264 NVIDIA': {
    ffmpeg: 'h264_nvenc',
    rateControl: ['CBR', 'VBR', 'CQ', 'VBV'],
    keyframeInterval: true,
    preset: PRESETS_SPEED,
    profile: ['Baseline', 'Main', 'High'],
    tune: ['None'],
  },
  'H.265 NVIDIA': {
    ffmpeg: 'hevc_nvenc',
    rateControl: ['CBR', 'VBR', 'CQ', 'VBV'],
    keyframeInterval: true,
    preset: PRESETS_SPEED,
    profile: ['Main', 'High 10'],
    tune: ['None'],
  },
  'AV1 NVIDIA': {
    ffmpeg: 'av1_nvenc',
    rateControl: ['CBR', 'VBR', 'CQ'],
    keyframeInterval: true,
    preset: PRESETS_SPEED,
    profile: ['Main'],
    tune: ['None'],
  },
  'H.264 IQS': {
    ffmpeg: 'h264_qsv',
    rateControl: ['CBR', 'VBR', 'QP', 'CQ'],
    keyframeInterval: true,
    preset: PRESETS_QSV,
    profile: ['Baseline', 'Main', 'High'],
    tune: ['None'],
  },
  'HEVC IQS': {
    ffmpeg: 'hevc_qsv',
    rateControl: ['CBR', 'VBR', 'QP', 'CQ'],
    keyframeInterval: true,
    preset: PRESETS_QSV,
    profile: ['Main', 'High 10'],
    tune: ['None'],
  },
  'AV1 IQS': {
    ffmpeg: 'av1_qsv',
    rateControl: ['CBR', 'VBR', 'QP'],
    keyframeInterval: true,
    preset: PRESETS_QSV,
    profile: ['Main'],
    tune: ['None'],
  },
  'H.264 AMD': {
    ffmpeg: 'h264_amf',
    rateControl: ['CBR', 'VBR', 'QP'],
    keyframeInterval: true,
    preset: PRESETS_SPEED,
    profile: ['Baseline', 'Main', 'High'],
    tune: ['None'],
  },
  'HEVC AMD': {
    ffmpeg: 'hevc_amf',
    rateControl: ['CBR', 'VBR', 'QP'],
    keyframeInterval: true,
    preset: PRESETS_SPEED,
    profile: ['Main', 'High 10'],
    tune: ['None'],
  },
  'MPEG-4': {
    ffmpeg: 'mpeg4',
    rateControl: ['CBR', 'VBR'],
    keyframeInterval: true,
    preset: ['None'],
    profile: ['None'],
    tune: ['None'],
  },
  'MPEG-2': {
    ffmpeg: 'mpeg2video',
    rateControl: ['CBR', 'VBR'],
    keyframeInterval: true,
    preset: ['None'],
    profile: ['None'],
    tune: ['None'],
  },
  'None': {
    ffmpeg: 'copy',
    rateControl: ['None'],
    keyframeInterval: false,
    preset: ['None'],
    profile: ['None'],
    tune: ['None'],
  },
};

const AUDIO_ENCODERS = {
  'AAC': { ffmpeg: 'aac', bitrates: [64, 96, 128, 160, 192, 224, 256, 320] },
  'Opus': { ffmpeg: 'libopus', bitrates: [64, 96, 128, 160, 192, 224, 256, 320] },
  'MP3': { ffmpeg: 'libmp3lame', bitrates: [64, 96, 128, 160, 192, 224, 256, 320] },
  'AC-3': { ffmpeg: 'ac3', bitrates: [128, 192, 224, 256, 320, 384, 448] },
  'EAC-3': { ffmpeg: 'eac3', bitrates: [128, 192, 224, 256, 320, 384, 448, 640] },
  'FLAC': { ffmpeg: 'flac', bitrates: [] },
  'PCM 16': { ffmpeg: 'pcm_s16le', bitrates: [] },
  'None': { ffmpeg: 'copy', bitrates: [] },
};

function capabilitiesPayload() {
  const video = {};
  for (const [label, def] of Object.entries(VIDEO_ENCODERS)) {
    video[label] = {
      rateControl: def.rateControl,
      keyframeInterval: def.keyframeInterval,
      preset: def.preset,
      profile: def.profile,
      tune: def.tune,
    };
  }
  const audio = {};
  for (const [label, def] of Object.entries(AUDIO_ENCODERS)) {
    audio[label] = { bitrates: def.bitrates };
  }
  return { video, audio };
}

module.exports = { VIDEO_ENCODERS, AUDIO_ENCODERS, capabilitiesPayload };
