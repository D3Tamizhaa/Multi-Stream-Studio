const {
  app,
  BrowserWindow,
  ipcMain,
} = require('electron')

const path = require('node:path')
const fs = require('node:fs')

let mainWindow = null


let lastFfmpegError = ''

function getDevUrl() {
  return (
    process.env.VITE_DEV_SERVER_URL ||
    'http://127.0.0.1:5173'
  )
}

function getProductionHtml() {
  return path.join(
    app.getAppPath(),
    'dist',
    'index.html',
  )
}

function parseResolution(value) {
  const match = String(value || '').match(
    /^(\d+)x(\d+)$/,
  )

  if (!match) {
    return {
      width: 1920,
      height: 1080,
    }
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

function getEncoder(encoder) {
  const value = String(
    encoder || '',
  ).toLowerCase()

  if (value.includes('nvenc')) {
    return 'h264_nvenc'
  }

  if (value.includes('qsv')) {
    return 'h264_qsv'
  }

  if (value.includes('amf')) {
    return 'h264_amf'
  }

  return 'libx264'
}

async function createWindow() {
  mainWindow =
    new BrowserWindow({
      width: 1440,
      height: 900,

      minWidth: 1100,
      minHeight: 700,

      backgroundColor:
        '#080b12',

      webPreferences: {
        preload: path.join(
          __dirname,
          'preload.cjs',
        ),

        contextIsolation: true,

        nodeIntegration: false,

        sandbox: false,
      },
    })

  const devMode =
    !app.isPackaged

  if (devMode) {
    const url =
      getDevUrl()

    console.log(
      `[MSS] Loading ${url}`,
    )

    await mainWindow.loadURL(
      url,
    )
  } else {
    const html =
      getProductionHtml()

    if (!fs.existsSync(html)) {
      throw new Error(
        `Production UI not found: ${html}`,
      )
    }

    await mainWindow.loadFile(
      html,
    )
  }

  /*
   * Open DevTools automatically during
   * development so errors are visible.
   */
  if (devMode) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on(
    'closed',
    () => {
      stopFfmpeg()
      mainWindow = null
    },
  )
}

app.whenReady().then(
  async () => {
    await createWindow()

    app.on(
      'activate',
      () => {
        if (
          BrowserWindow.getAllWindows()
            .length === 0
        ) {
          createWindow()
        }
      },
    )
  },
)

app.on(
  'window-all-closed',
  () => {
    stopFfmpeg()

    if (
      process.platform !==
      'darwin'
    ) {
      app.quit()
    }
  },
)
