'use strict';
/**
 * Encoder capability map. Drives the "only show options this encoder
 * supports" behaviour in the Output settings UI, and is the single
 * source of truth used server-side to build real FFmpeg arguments.
 *
 * These mappings are pragmatic approximations of real FFmpeg/codec
 * capabilities intended to make the UI behave sensibly and produce a
 * working stream on common hardware. Tune ffmpegName / flags for your
 * exact FFmpeg build & GPU drivers if needed.
 */

const PRESETS_X264_X265 = ['Ultra Fast', 'Super Fast', 'Very Fast', 'Faster', 'Fast', 'Medium', 'Slow', 'Slower', 'Very Slow', 'Placebo'];
const PRESETS_HW = ['Fast', 'Medium', 'Slow'];
const PROFILES_H264 = ['Baseline', 'Main', 'High'];
const PROFILES_H265 = ['Main', 'High 10'];
const TUNES_X264 = ['Zero latency', 'Film', 'Animation', 'Grain', 'Still image', 'PSNR', 'SSIM', 'Fast decode'];
const TUNES_X265 = ['Zero latency', 'Grain', 'PSNR', 'SSIM', 'Fast decode'];

const VIDEO_ENCODERS = {
  'H.264': { ffmpegName: 'libx264', rateControl: ['CBR', 'VBR', 'CRF', 'VBV'], preset: PRESETS_X264_X265, profile: PROFILES_H264, tune: TUNES_X264, keyframe: true },
  'H.265': { ffmpegName: 'libx265', rateControl: ['CBR', 'VBR', 'CRF'], preset: PRESETS_X264_X265, profile: PROFILES_H265, tune: TUNES_X265, keyframe: true },
  'VP9': { ffmpegName: 'libvpx-vp9', rateControl: ['CBR', 'VBR', 'CQ'], preset: [], profile: [], tune: [], keyframe: true },
  'AV1': { ffmpegName: 'libaom-av1', rateControl: ['CRF', 'VBR', 'CQ'], preset: [], profile: [], tune: [], keyframe: true },
  'SVT AV1': { ffmpegName: 'libsvtav1', rateControl: ['CRF', 'VBR'], preset: ['Very Fast', 'Fast', 'Medium', 'Slow', 'Very Slow'], profile: [], tune: [], keyframe: true },
  'H.264 NVIDIA': { ffmpegName: 'h264_nvenc', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: PROFILES_H264, tune: [], keyframe: true },
  'H.265 NVIDIA': { ffmpegName: 'hevc_nvenc', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: PROFILES_H265, tune: [], keyframe: true },
  'AV1 NVIDIA': { ffmpegName: 'av1_nvenc', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: [], tune: [], keyframe: true },
  'H.264 IQS': { ffmpegName: 'h264_qsv', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: PROFILES_H264, tune: [], keyframe: true },
  'HEVC IQS': { ffmpegName: 'hevc_qsv', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: PROFILES_H265, tune: [], keyframe: true },
  'AV1 IQS': { ffmpegName: 'av1_qsv', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: [], tune: [], keyframe: true },
  'H.264 AMD': { ffmpegName: 'h264_amf', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: PROFILES_H264, tune: [], keyframe: true },
  'HEVC AMD': { ffmpegName: 'hevc_amf', rateControl: ['CBR', 'VBR', 'CQ'], preset: PRESETS_HW, profile: PROFILES_H265, tune: [], keyframe: true },
  'MPEG-4': { ffmpegName: 'mpeg4', rateControl: ['CBR', 'VBR', 'QP'], preset: [], profile: [], tune: [], keyframe: true },
  'MPEG-2': { ffmpegName: 'mpeg2video', rateControl: ['CBR', 'VBR', 'QP'], preset: [], profile: [], tune: [], keyframe: true },
  'None': { ffmpegName: 'copy', rateControl: ['None'], preset: [], profile: [], tune: [], keyframe: false }
};

const AUDIO_ENCODERS = {
  'AAC': { ffmpegName: 'aac' },
  'Opus': { ffmpegName: 'libopus' },
  'MP3': { ffmpegName: 'libmp3lame' },
  'AC-3': { ffmpegName: 'ac3' },
  'EAC-3': { ffmpegName: 'eac3' },
  'FLAC': { ffmpegName: 'flac' },
  'PCM 16': { ffmpegName: 'pcm_s16le' },
  'None': { ffmpegName: 'copy' }
};

const PRESET_MAP = {
  'Ultra Fast': 'ultrafast', 'Super Fast': 'superfast', 'Very Fast': 'veryfast', 'Faster': 'faster',
  'Fast': 'fast', 'Medium': 'medium', 'Slow': 'slow', 'Slower': 'slower', 'Very Slow': 'veryslow', 'Placebo': 'placebo'
};
const PROFILE_MAP = { 'Baseline': 'baseline', 'Main': 'main', 'High': 'high', 'High 10': 'main10', 'High 422': 'high422', 'High 444': 'high444' };
const TUNE_MAP = {
  'Zero latency': 'zerolatency', 'Film': 'film', 'Animation': 'animation', 'Grain': 'grain',
  'Still image': 'stillimage', 'PSNR': 'psnr', 'SSIM': 'ssim', 'Fast decode': 'fastdecode'
};

function listForUI() {
  const video = {};
  for (const [name, cfg] of Object.entries(VIDEO_ENCODERS)) {
    video[name] = { rateControl: cfg.rateControl, preset: cfg.preset, profile: cfg.profile, tune: cfg.tune, keyframe: cfg.keyframe };
  }
  return { video, audio: Object.keys(AUDIO_ENCODERS) };
}

module.exports = { VIDEO_ENCODERS, AUDIO_ENCODERS, PRESET_MAP, PROFILE_MAP, TUNE_MAP, listForUI };
