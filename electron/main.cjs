const {
  app,
  BrowserWindow,
  ipcMain,
} = require('electron')

const os = require('node:os')
const path = require('node:path')

let mainWindow

let previousCpu = null

function getCpuSnapshot() {
  const cpus = os.cpus()

  let idle = 0
  let total = 0

  for (const cpu of cpus) {
    const times = cpu.times

    idle += times.idle

    total +=
      times.user +
      times.nice +
      times.sys +
      times.irq +
      times.idle
  }

  return {
    idle,
    total,
  }
}

function getCpuUsage() {
  const current = getCpuSnapshot()

  if (!previousCpu) {
    previousCpu = current
    return 0
  }

  const idleDelta = current.idle - previousCpu.idle
  const totalDelta = current.total - previousCpu.total

  previousCpu = current

  if (totalDelta <= 0) {
    return 0
  }

  const usage = 100 * (1 - idleDelta / totalDelta)

  return Math.max(0, Math.min(100, usage))
}

function getSystemStats() {
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()

  const usedMemory = totalMemory - freeMemory

  const ram = (usedMemory / totalMemory) * 100

  const cpu = getCpuUsage()

  return {
    cpu: Math.max(0, Math.min(100, cpu)),
    ram: Math.max(0, Math.min(100, ram)),
  }
}

ipcMain.handle('system-stats', () => {
  return getSystemStats()
})

async function waitForVite(url, retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(url)
      return true
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, 250)
      })
    }
  }

  return false
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,

    backgroundColor: '#070a10',

    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (!app.isPackaged) {
    const devUrl = 'http://127.0.0.1:5173'

    const ready = await waitForVite(devUrl)

    if (!ready) {
      console.error('Vite server was not available.')
      app.quit()
      return
    }

    await mainWindow.loadURL(devUrl)

    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
    )
  }
}

app.whenReady().then(async () => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
