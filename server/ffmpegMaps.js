// Central source of truth for encoder capability -> FFmpeg flags.
// Hardware encoders (NVIDIA/QSV/AMD) require matching drivers + an FFmpeg build
// with those encoders compiled in. They are exposed in the UI per spec, but
// will fail at stream-start time with a clear error if the host can't run them.

const VIDEO_ENCODERS = {
  'H.264':        { ffmpeg: 'libx264',    rateControl: ['CBR','VBR','CRF','VBV','None'], preset: ['Ultra Fast','Super Fast','Very Fast','Faster','Fast','Medium','Slow','Slower','Very Slow','Placebo','None'], profile: ['Baseline','Main','High','None'], tune: ['Zero latency','Film','Animation','Grain','Still image','PSNR','SSIM','Fast decode','None'] },
  'H.265':        { ffmpeg: 'libx265',    rateControl: ['CBR','VBR','CRF','VBV','None'], preset: ['Ultra Fast','Super Fast','Very Fast','Faster','Fast','Medium','Slow','Slower','Very Slow','Placebo','None'], profile: ['Main','High 10','None'], tune: ['Zero latency','Grain','PSNR','SSIM','Fast decode','None'] },
  'VP9':          { ffmpeg: 'libvpx-vp9', rateControl: ['CBR','VBR','CRF','None'],       preset: ['None'], profile: ['None'], tune: ['None'] },
  'AV1':          { ffmpeg: 'libaom-av1', rateControl: ['CBR','VBR','CRF','CQ','None'],  preset: ['None'], profile: ['None'], tune: ['None'] },
  'SVT AV1':      { ffmpeg: 'libsvtav1',  rateControl: ['CBR','VBR','CRF','None'],       preset: ['Fastest: 12','Fast: 8','Medium: 6','Slow: 4','Slowest: 0'].concat(['None']), profile: ['None'], tune: ['None'] },
  'H.264 NVIDIA': { ffmpeg: 'h264_nvenc', rateControl: ['CBR','VBR','CQ','VBV','None'],  preset: ['Fast','Medium','Slow','None'], profile: ['Baseline','Main','High','None'], tune: ['None'] },
  'H.265 NVIDIA': { ffmpeg: 'hevc_nvenc', rateControl: ['CBR','VBR','CQ','VBV','None'],  preset: ['Fast','Medium','Slow','None'], profile: ['Main','High','None'],           tune: ['None'] },
  'AV1 NVIDIA':   { ffmpeg: 'av1_nvenc',  rateControl: ['CBR','VBR','CQ','None'],        preset: ['Fast','Medium','Slow','None'], profile: ['None'], tune: ['None'] },
  'H.264 IQS':    { ffmpeg: 'h264_qsv',   rateControl: ['CBR','VBR','CQ','ABR','None'],  preset: ['Fast','Medium','Slow','None'], profile: ['Baseline','Main','High','None'], tune: ['None'] },
  'HEVC IQS':     { ffmpeg: 'hevc_qsv',   rateControl: ['CBR','VBR','CQ','ABR','None'],  preset: ['Fast','Medium','Slow','None'], profile: ['Main','High','None'],           tune: ['None'] },
  'AV1 IQS':      { ffmpeg: 'av1_qsv',    rateControl: ['CBR','VBR','CQ','None'],        preset: ['Fast','Medium','Slow','None'], profile: ['None'], tune: ['None'] },
  'H.264 AMD':    { ffmpeg: 'h264_amf',   rateControl: ['CBR','VBR','CQ','None'],        preset: ['Fast','Medium','Slow','None'], profile: ['Baseline','Main','High','None'], tune: ['None'] },
  'HEVC AMD':     { ffmpeg: 'hevc_amf',   rateControl: ['CBR','VBR','CQ','None'],        preset: ['Fast','Medium','Slow','None'], profile: ['Main','High','None'],           tune: ['None'] },
  'MPEG-4':       { ffmpeg: 'mpeg4',      rateControl: ['CBR','VBR','QP','None'],        preset: ['None'], profile: ['None'], tune: ['None'] },
  'MPEG-2':       { ffmpeg: 'mpeg2video', rateControl: ['CBR','VBR','QP','None'],        preset: ['None'], profile: ['None'], tune: ['None'] },
  'None':         { ffmpeg: 'copy',       rateControl: ['None'], preset: ['None'], profile: ['None'], tune: ['None'] }
};

const AUDIO_ENCODERS = {
  'AAC':  'aac',
  'Opus': 'libopus',
  'MP3':  'libmp3lame',
  'AC-3': 'ac3',
  'EAC-3': 'eac3',
  'FLAC': 'flac',
  'PCM 16': 'pcm_s16le',
  'None': 'copy'
};

const PRESET_FLAG = {
  'Ultra Fast': 'ultrafast', 'Super Fast': 'superfast', 'Very Fast': 'veryfast',
  'Faster': 'faster', 'Fast': 'fast', 'Medium': 'medium', 'Slow': 'slow',
  'Slower': 'slower', 'Very Slow': 'veryslow', 'Placebo': 'placebo'
};

const SERVICE_SERVERS = {
  YouTube:  'rtmp://a.rtmp.youtube.com/live2',
  Facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
  Twitch:   'rtmp://live.twitch.tv/app',
  Kick:     'rtmps://fa723fc1b171.global-contribute.live-video.net'
};

module.exports = { VIDEO_ENCODERS, AUDIO_ENCODERS, PRESET_FLAG, SERVICE_SERVERS };
