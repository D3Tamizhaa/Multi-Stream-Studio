const { contextBridge, ipcRenderer } = require('electron')

const pendingPorts = new Map()
const activePorts = new Map()

function resolvePort(sessionId, port) {
  activePorts.set(sessionId, port)

  const pending = pendingPorts.get(sessionId)

  if (pending) {
    pendingPorts.delete(sessionId)
    pending.resolve()
  }
}

ipcRenderer.on('stream-port', (event, sessionId) => {
  const [port] = event.ports

  if (!port) {
    return
  }

  port.start()

  port.onmessage = (messageEvent) => {
    const data = messageEvent.data

    if (data?.type === 'ack') {
      window.dispatchEvent(
        new CustomEvent('mss-stream-ack', {
          detail: data,
        }),
      )

      return
    }

    if (data?.type === 'status') {
      window.dispatchEvent(
        new CustomEvent('mss-stream-status', {
          detail: data,
        }),
      )

      return
    }
  }

  port.onmessageerror = (error) => {
    console.error(
      '[Stream Bridge] MessagePort error:',
      error,
    )
  }

  resolvePort(sessionId, port)
})

function waitForPort(sessionId) {
  if (activePorts.has(sessionId)) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    pendingPorts.set(sessionId, {
      resolve,
      reject,
    })

    setTimeout(() => {
      if (pendingPorts.has(sessionId)) {
        pendingPorts.delete(sessionId)

        reject(
          new Error(
            'Timed out waiting for the native FFmpeg stream bridge.',
          ),
        )
      }
    }, 5000)
  })
}

/*
 * Binary video/audio data is transferred from the
 * renderer main world to this isolated preload world,
 * then forwarded through the MessagePort to Electron.
 *
 * ArrayBuffer is transferred, not copied.
 */
window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return
  }

  const message = event.data

  if (
    !message ||
    message.__mssStream !== true
  ) {
    return
  }

  const sessionId = message.sessionId
  const port = activePorts.get(sessionId)

  if (!port) {
    return
  }

  const buffer = message.buffer

  if (!(buffer instanceof ArrayBuffer)) {
    return
  }

  try {
    port.postMessage(
      {
        type: message.type,
        buffer,
      },
      [buffer],
    )
  } catch (error) {
    console.error(
      '[Stream Bridge] Failed to transfer media buffer:',
      error,
    )
  }
})

contextBridge.exposeInMainWorld(
  'electronStream',
  {
    start: async (config) => {
      const result =
        await ipcRenderer.invoke(
          'stream:start',
          config,
        )

      if (!result?.ok) {
        throw new Error(
          result?.error ||
            'Unable to start native stream engine.',
        )
      }

      await waitForPort(
        result.sessionId,
      )

      return result
    },

    stop: async () => {
      const result =
        await ipcRenderer.invoke(
          'stream:stop',
        )

      return result
    },

    status: async () => {
      return ipcRenderer.invoke(
        'stream:status',
      )
    },

    isAvailable: true,
  },
)
