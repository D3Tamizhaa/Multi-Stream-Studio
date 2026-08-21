export type SourceType =
  | 'image'
  | 'browser'
  | 'media'
  | 'text'

export type AudioMonitoringMode =
  | 'off'
  | 'monitor-only'
  | 'monitor-and-output'

export type StreamingStatus =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'stopping'
  | 'error'

export interface FfmpegInputConfig {
  inputArgs: string[]
  videoArgs: string[]
  audioArgs: string[]
  advancedArgs: string[]
}

export interface PlatformStreamStatus {
  platformId: string
  enabled: boolean
  connected: boolean
  error?: string
}

export interface StreamingState {
  status: StreamingStatus
  startedAt: number | null
  platforms: PlatformStreamStatus[]
  error: string | null
}

export type SettingsSection =
  | 'Authorization'
  | 'Stream'
  | 'Output'
  | 'Audio'
  | 'Video'
  | 'Advanced'

export type PlatformName =
  | 'YouTube'
  | 'Facebook'
  | 'Twitch'
  | 'Kick'
  | 'Custom'

export type BuiltInPlatformName =
  | 'YouTube'
  | 'Facebook'
  | 'Twitch'
  | 'Kick'

export interface Scene {
  id: string
  name: string
}

export interface Source {
  id: string
  name: string
  type: SourceType
  sceneId: string
  visible: boolean
  locked: boolean
  properties: {
    file?: string
    url?: string

    // Preview canvas position
    x?: number
    y?: number

    // Preview canvas size
    width?: number
    height?: number

    css?: string
    loop?: boolean

    // Text settings
    fontFamily?: string
    fontSize?: number
    text?: string
    color?: string
  }
}

export interface Platform {
  id: string
  name: PlatformName
  customName?: string
  enabled: boolean
  server: string
  streamKey: string
}

export interface StudioSettings {
  authorization: {
    username: string
    password: string
  }
stream: {
  service: PlatformName
  customServiceName: string
  server: string
  streamKey: string
}
  output: {
    encoder: 'H.264',
    rateControl: 'CBR',
    bitrate: '2500',
    keyframeInterval: '2',
    preset: 'veryfast',
    profile: 'High',
    tune: 'zerolatency',
}

  audio: {
    encoder: string
    bitrate: string
    sampleRate: string
    channels: string
  }
  video: {
    baseResolution: string
    outputResolution: string
    fps: string
  }
  advanced: {
    automaticallyReconnect: true,
    network: 'Auto',
    ffmpegInputArgs: '',
    ffmpegOutputArgs: '',
    ffmpegAudioArgs: '',
    ffmpegVideoArgs: '',
  }
}
