export type SourceType =
  | 'image'
  | 'browser'
  | 'media'
  | 'text'

export type AudioMonitoringMode =
  | 'off'
  | 'monitor-only'
  | 'monitor-and-output'

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
    encoder: string
    rateControl: string
    bitrate: string
    keyframeInterval: string
    preset: string
    profile: string
    tune: string
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
    network: string
  }
}
