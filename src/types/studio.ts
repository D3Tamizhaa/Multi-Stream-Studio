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

export interface FfmpegOutput {
  platformId: string
  platformName: PlatformName
  url: string
}

export interface FfmpegStreamConfig {
  inputArgs: string[]
  videoArgs: string[]
  audioArgs: string[]
  advancedArgs: string[]

  video: {
    width: number
    height: number
    fps: number
  }

  audio: {
    enabled: boolean
    volume: number
  }

  outputs: FfmpegOutput[]
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

export type StreamingEvent =
  | {
      type: 'started'
      startedAt: number
    }
  | {
      type: 'connected'
      platformId: string
    }
  | {
      type: 'disconnected'
      platformId: string
    }
  | {
      type: 'stderr'
      data: string
    }
  | {
      type: 'stdout'
      data: string
    }
  | {
      type: 'error'
      error: string
    }
  | {
      type: 'exit'
      code: number | null
      signal: string | null
      intentional: boolean
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
  automaticallyReconnect: boolean
  network: 'Auto' | 'IPv4' | 'IPv6'
  ffmpegInputArgs: string
  ffmpegOutputArgs: string
  ffmpegAudioArgs: string
  ffmpegVideoArgs: string
}
}
