import type {
  FfmpegStreamConfig,
  StreamingEvent,
} from '../types/studio'

declare global {
  interface Window {
    multiStreamStudio?: {
      streaming: {
        start: (
          config: FfmpegStreamConfig,
        ) => Promise<{
          ok: boolean
          error?: string
        }>

        stop: () => Promise<{
          ok: boolean
          error?: string
        }>

        status: () => Promise<{
          running: boolean
          startedAt: number | null
        }>

        onEvent: (
          callback: (
            event: StreamingEvent,
          ) => void,
        ) => () => void
      }
    }
  }
}

export function isElectronStreamingAvailable() {
  return Boolean(
    window.multiStreamStudio?.streaming,
  )
}

export async function startFfmpegStreaming(
  config: FfmpegStreamConfig,
) {
  if (
    !window.multiStreamStudio?.streaming
  ) {
    throw new Error(
      'Electron streaming bridge is unavailable.',
    )
  }

  return window.multiStreamStudio.streaming.start(
    config,
  )
}

export async function stopFfmpegStreaming() {
  if (
    !window.multiStreamStudio?.streaming
  ) {
    return
  }

  return window.multiStreamStudio.streaming.stop()
}

export function subscribeToStreamingEvents(
  callback: (
    event: StreamingEvent,
  ) => void,
) {
  return (
    window.multiStreamStudio?.streaming.onEvent(
      callback,
    ) ?? (() => {})
  )
}
