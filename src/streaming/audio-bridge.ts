export interface AudioBridge {
  stop: () => void
}

interface AudioBridgeOptions {
  volume: number
  muted: boolean
  monitoringMode:
    | 'off'
    | 'monitor-only'
    | 'monitor-and-output'
  sessionId: string
}

function postAudio(
  sessionId: string,
  buffer: ArrayBuffer,
) {
  const targetOrigin =
    window.location.protocol ===
    'file:'
      ? '*'
      : window.location.origin

  window.postMessage(
    {
      __mssStream: true,
      sessionId,
      type: 'audio',
      buffer,
    },
    targetOrigin,
    [buffer],
  )
}

export async function startAudioBridge(
  options: AudioBridgeOptions,
): Promise<AudioBridge> {
  const videos =
    Array.from(
      document.querySelectorAll<HTMLVideoElement>(
        '.preview-stage video',
      ),
    )

  const AudioContextClass =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext

  if (!AudioContextClass) {
    throw new Error(
      'Web Audio is not supported by this Electron runtime.',
    )
  }

  const context =
    new AudioContextClass({
      sampleRate: 48000,
    })

  if (context.state === 'suspended') {
    await context.resume()
  }

  const master =
    context.createGain()

  master.gain.value =
    options.muted
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            options.volume / 100,
          ),
        )

  const processor =
    context.createScriptProcessor(
      2048,
      2,
      2,
    )

  /*
   * Always connect the processor to the
   * destination so it keeps processing.
   *
   * Monitoring can be disabled with zero gain.
   */
  const monitorGain =
    context.createGain()

  monitorGain.gain.value =
    options.monitoringMode ===
      'off' ||
    options.monitoringMode ===
      'monitor-only'
      ? options.monitoringMode ===
        'monitor-only'
        ? 1
        : 0
      : 1

  const destination =
    context.destination

  const sourceNodes =
    new Map<
      HTMLVideoElement,
      MediaElementAudioSourceNode
    >()

  for (const video of videos) {
    try {
      const sourceNode =
        context.createMediaElementSource(
          video,
        )

      sourceNodes.set(
        video,
        sourceNode,
      )

      /*
       * Prevent the original HTML video
       * from also producing an uncontrolled
       * duplicate audio path.
       */
      video.muted = true

      sourceNode.connect(
        master,
      )
    } catch (error) {
      console.warn(
        '[Audio Bridge] Could not connect video audio:',
        error,
      )
    }
  }

  master.connect(
    processor,
  )

  processor.connect(
    monitorGain,
  )

  monitorGain.connect(
    destination,
  )

  processor.onaudioprocess =
    (event) => {
      const left =
        event.inputBuffer.getChannelData(
          0,
        )

      const right =
        event.inputBuffer.numberOfChannels >
        1
          ? event.inputBuffer.getChannelData(
              1,
            )
          : left

      const sampleCount =
        left.length

      const pcm =
        new Int16Array(
          sampleCount * 2,
        )

      for (
        let index = 0;
        index < sampleCount;
        index++
      ) {
        const l =
          Math.max(
            -1,
            Math.min(
              1,
              left[index],
            ),
          )

        const r =
          Math.max(
            -1,
            Math.min(
              1,
              right[index],
            ),
          )

        pcm[index * 2] =
          l < 0
            ? l * 32768
            : l * 32767

        pcm[index * 2 + 1] =
          r < 0
            ? r * 32768
            : r * 32767
      }

      /*
       * Transfer PCM directly to native
       * Electron/FFmpeg bridge.
       */
      postAudio(
        options.sessionId,
        pcm.buffer,
      )
    }

  return {
    stop() {
      processor.onaudioprocess =
        null

      try {
        processor.disconnect()
      } catch {}

      try {
        master.disconnect()
      } catch {}

      try {
        monitorGain.disconnect()
      } catch {}

      for (const node of sourceNodes.values()) {
        try {
          node.disconnect()
        } catch {}
      }

      for (const video of videos) {
        video.muted =
          options.muted ||
          options.monitoringMode ===
            'off'
      }

      context.close().catch(() => {})
    },
  }
}
