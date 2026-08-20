interface ElectronStreamStartResult {
  ok: boolean
  sessionId: string
}

interface ElectronStreamStatus {
  running: boolean
  uptime: number
  fps: number
  bitrate: string
  speed: string
  error: string
}

interface ElectronStreamAPI {
  isAvailable: boolean

  start: (
    config: unknown,
  ) => Promise<ElectronStreamStartResult>

  stop: () => Promise<{
    ok: boolean
  }>

  status: () => Promise<ElectronStreamStatus>
}

interface Window {
  electronStream?: ElectronStreamAPI
}
