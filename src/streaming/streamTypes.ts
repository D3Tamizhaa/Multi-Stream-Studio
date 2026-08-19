import type {
  Source,
  StudioSettings,
} from '../types/studio'

export interface StreamScene {
  sources: Source[]
}

export interface StreamStartOptions {
  settings: StudioSettings
  scene: StreamScene
}

export interface StreamStatus {
  running: boolean
  bitrate: number
  fps: number
  error?: string
}
