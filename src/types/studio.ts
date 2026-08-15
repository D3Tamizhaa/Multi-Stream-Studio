export type SourceType =
  | 'image'
  | 'browser'
  | 'media'
  | 'text'

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

export interface Scene {
  id: string
  name: string
}

export interface Source {
  id: string
  name: string
  type: SourceType
  visible: boolean
  locked: boolean
  properties: {
    file?: string
    url?: string
    width?: number
    height?: number
    css?: string
    loop?: boolean
    fontFamily?: string
    fontSize?: number
    text?: string
    color?: string
  }
}

export interface Platform {
  id: string
  name: PlatformName
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
