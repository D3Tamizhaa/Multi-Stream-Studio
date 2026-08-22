const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('multiStreamStudio', {
  streaming: {
    start: (config) => ipcRenderer.invoke('streaming:start', config),

    stop: () => ipcRenderer.invoke('streaming:stop'),

    status: () => ipcRenderer.invoke('streaming:status'),

    sendVideoFrame: (frame) => {
      ipcRenderer.send('streaming:video-frame', frame)
    },

    sendAudioChunk: (chunk) => {
      ipcRenderer.send('streaming:audio-chunk', chunk)
    },

    onEvent: (callback) => {
      const listener = (_event, data) => {
        callback(data)
      }

      ipcRenderer.on('streaming:event', listener)

      return () => {
        ipcRenderer.removeListener(
          'streaming:event',
          listener,
        )
      }
    },
  },
})
