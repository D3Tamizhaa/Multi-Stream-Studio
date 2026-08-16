const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('systemStats', {
  get: () => ipcRenderer.invoke('system-stats'),
})
