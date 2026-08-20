const {
  contextBridge,
  ipcRenderer,
} = require('electron')

const ports =
  new Map()

ipcRenderer.on(
  'stream-port',
  (event) => {
    const port =
      event.ports?.[0]

    if (!port) {
      console.error(
        '[MSS] Stream MessagePort was not received.',
      )

      return
    }

    port.start()

    port.onmessage =
      (messageEvent) => {
        const data =
          messageEvent.data

        window.postMessage(
          {
            __mssNativeStreamEvent:
              true,

            ...data,
          },
          '*',
        )
      }

    /*
     * The current stream session is sent
     * through the start result and stored
     * by React.
     *
     * We use one active port.
     */
    ports.set(
      'active',
      port,
    )

    window.postMessage(
      {
        __mssNativeStreamEvent:
          true,

        type:
          'port-ready',
      },
      '*',
    )
  },
)

window.addEventListener(
  'message',
  (event) => {
    if (
      event.source !==
      window
    ) {
      return
    }

    const message =
      event.data

    if (
      !message ||
      message.__mssStream !== true
    ) {
      return
    }

    const port =
      ports.get('active')

    if (!port) {
      console.error(
        '[MSS] Stream port is not ready.',
      )

      return
    }

    if (
      !message.buffer
    ) {
      return
    }

    try {
      port.postMessage(
        {
          type:
            message.type,

          buffer:
            message.buffer,
        },

        [
          message.buffer,
        ],
      )
    } catch (error) {
      console.error(
        '[MSS] Failed to send media to native process:',
        error,
      )
    }
  },
)

contextBridge.exposeInMainWorld(
  'electronStream',
  {
    isAvailable: true,

    start: (
      config,
    ) =>
      ipcRenderer.invoke(
        'stream:start',
        config,
      ),

    stop: () =>
      ipcRenderer.invoke(
        'stream:stop',
      ),

    status: () =>
      ipcRenderer.invoke(
        'stream:status',
      ),
  },
)
