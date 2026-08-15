import type {
  Platform,
  Scene,
  Source,
  StudioSettings,
} from '../types/studio'

export const defaultScenes: Scene[] = [
  { id: 'scene-1', name: 'Scene 1' },
  { id: 'scene-2', name: 'Scene 2' },
]

export const defaultSources: Source[] = [
  {
    id: 'source-image',
    name: 'Image',
    type: 'image',
    visible: true,
    locked: true,
    properties: {
      file: 'studio-image.png',
      width: 640,
      height: 360,
    },
  },
  {
    id: 'source-browser',
    name: 'Browser Source',
    type: 'browser',
    visible: false,
    locked: true,
    properties: {
      url: 'https://example.com',
      width: 640,
      height: 360,
      css: '',
    },
  },
  {
    id: 'source-media',
    name: 'Media File',
    type: 'media',
    visible: true,
    locked: true,
    properties: {
      file: 'media.mp4',
      loop: true,
    },
  },
  {
    id: 'source-text',
    name: 'Text',
    type: 'text',
    visible: false,
    locked: false,
    properties: {
      text: 'My Text',
      fontFamily: 'Inter',
      fontSize: 32,
      color: '#ffffff',
      width: 300,
      height: 80,
    },
  },
]

export const defaultPlatforms: Platform[] = [
  {
    id: 'platform-youtube',
    name: 'YouTube',
    enabled: true,
    server: '',
    streamKey: '',
  },
  {
    id: 'platform-twitch',
    name: 'Twitch',
    enabled: false,
    server: '',
    streamKey: '',
  },
]

export const defaultSettings: StudioSettings = {
  authorization: {
    username: '',
    password: '',
  },
  stream: {
    service: 'YouTube',
    server: '',
    streamKey: '',
  },
  output: {
    encoder: 'H.264',
    rateControl: 'CBR',
    bitrate: '6000',
    keyframeInterval: '2',
    preset: 'Quality',
    profile: 'High',
    tune: 'None',
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
    fps: '60',
  },
  advanced: {
    automaticallyReconnect: true,
    network: 'Auto',
  },
}
