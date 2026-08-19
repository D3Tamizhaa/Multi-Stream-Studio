import type {
  Platform,
  Scene,
  Source,
  StudioSettings,
} from '../types/studio'

export const defaultScenes: Scene[] = [
  {
    id: 'scene-1',
    name: 'Scene 1',
  },
]

export const defaultSources: Source[] = []

export const defaultPlatforms: Platform[] = []

export const defaultSettings: StudioSettings = {
  authorization: {
    username: '',
    password: '',
  },

stream: {
  service: 'YouTube' as const,
  customServiceName: '',
  server: 'rtmp://a.rtmp.youtube.com/live2',
  streamKey: '',
},

  output: {
    encoder: 'H.264',
    rateControl: 'CBR',
    bitrate: '6000',
    keyframeInterval: '2',
    preset: 'veryfast',
    profile: 'High',
    tune: 'zerolatency',
  },

  audio: {
    encoder: 'AAC',
    bitrate: '160',
    sampleRate: '48 kHz',
    channels: 'Stereo',
  },

video: {
  baseResolution: '1920x1080',
  outputResolution: '1920x1080',
  fps: '30',
},

  advanced: {
    automaticallyReconnect: true,
    network: 'Auto',
  },
}
