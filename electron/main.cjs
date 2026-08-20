const {
  app,
  BrowserWindow,
  ipcMain,
  MessageChannelMain,
} = require('electron')

const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')

let mainWindow = null

let ffmpegProcess = null
let streamPort = null
let streamSessionId = null

let streamStartedAt = 0

let streamStats = {
  fps: 0,
  bitrate: '0 kbits/s',
  speed: '0x',
}

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

function buildOutputUrl(platform) {
  const server = String(
    platform.server || '',
  ).trim()

  const key = String(
    platform.streamKey || '',
  ).trim()

  if (!server) {
    throw new Error(
      `${platform.name}: RTMP server is missing.`,
    )
  }

  if (!key) {
    throw new Error(
      `${platform.name}: Stream key is missing.`,
    )
  }

  return `${server.replace(
    /\/+$/,
    '',
  )}/${key}`
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

function buildFfmpegArgs(config) {
  const resolution =
    parseResolution(
      config.video?.outputResolution,
    )

  const fps =
    Number.parseInt(
      config.video?.fps,
      10,
    ) || 30

  const bitrate =
    Number.parseInt(
      config.output?.bitrate,
      10,
    ) || 6000

  const audioBitrate =
    Number.parseInt(
      config.audio?.bitrate,
      10,
    ) || 160

  const keyframeInterval =
    Number.parseInt(
      config.output?.keyframeInterval,
      10,
    ) || 2

  const gop =
    fps * keyframeInterval

  const encoder =
    getEncoder(
      config.output?.encoder,
    )

  const enabledPlatforms =
    Array.isArray(config.platforms)
      ? config.platforms.filter(
          (platform) =>
            platform.enabled &&
            platform.server?.trim() &&
            platform.streamKey?.trim(),
        )
      : []

  if (
    enabledPlatforms.length === 0
  ) {
    throw new Error(
      'No enabled platform has an RTMP server and stream key.',
    )
  }

  const outputs =
    enabledPlatforms.map(
      (platform) => {
        const url =
          buildOutputUrl(
            platform,
          )

        return (
          '[f=flv:onfail=ignore]' +
          url
        )
      },
    )

  return [
    '-hide_banner',

    '-loglevel',
    'info',

    '-nostats',

    /*
     * Progress information.
     */
    '-progress',
    'pipe:1',

    /*
     * VIDEO
     *
     * Electron -> pipe:3
     */
    '-thread_queue_size',
    '512',

    '-f',
    'rawvideo',

    '-pixel_format',
    'rgba',

    '-video_size',
    '1920x1080',

    '-framerate',
    String(fps),

    '-i',
    'pipe:3',

    /*
     * AUDIO
     *
     * Electron -> pipe:4
     */
    '-thread_queue_size',
    '512',

    '-f',
    's16le',

    '-ar',
    '48000',

    '-ac',
    '2',

    '-i',
    'pipe:4',

    /*
     * VIDEO
     */
    '-map',
    '0:v:0',

    '-c:v',
    encoder,

    '-preset',
    config.output?.preset ||
      'veryfast',

    '-tune',
    'zerolatency',

    '-profile:v',
    'high',

    '-pix_fmt',
    'yuv420p',

    '-vf',
    `scale=${resolution.width}:${resolution.height}`,

    '-r',
    String(fps),

    '-g',
    String(gop),

    '-keyint_min',
    String(gop),

    '-sc_threshold',
    '0',

    '-b:v',
    `${bitrate}k`,

    '-minrate',
    `${bitrate}k`,

    '-maxrate',
    `${bitrate}k`,

    '-bufsize',
    `${bitrate * 2}k`,

    /*
     * AUDIO
     */
    '-map',
    '1:a:0',

    '-c:a',
    'aac',

    '-b:a',
    `${audioBitrate}k`,

    '-ar',
    '48000',

    '-ac',
    '2',

    /*
     * OUTPUT
     */
    '-f',
    'tee',

    outputs.join('|'),
  ]
}

function stopFfmpeg() {
  if (streamPort) {
    try {
      streamPort.close()
    } catch {}
  }

  streamPort = null
  streamSessionId = null

  if (!ffmpegProcess) {
    return
  }

  try {
    ffmpegProcess.stdio[3]?.destroy()
  } catch {}

  try {
    ffmpegProcess.stdio[4]?.destroy()
  } catch {}

  try {
    ffmpegProcess.kill(
      process.platform === 'win32'
        ? undefined
        : 'SIGTERM',
    )
  } catch {}

  ffmpegProcess = null
  streamStartedAt = 0

  streamStats = {
    fps: 0,
    bitrate: '0 kbits/s',
    speed: '0x',
  }
}

function parseProgress(text) {
  const lines =
    String(text).split(/\r?\n/)

  for (const line of lines) {
    const index =
      line.indexOf('=')

    if (index < 0) {
      continue
    }

    const key =
      line.slice(0, index)

    const value =
      line.slice(index + 1)

    if (key === 'fps') {
      streamStats.fps =
        Number.parseFloat(value) || 0
    }

    if (key === 'bitrate') {
      streamStats.bitrate =
        value || '0 kbits/s'
    }

    if (key === 'speed') {
      streamStats.speed =
        value || '0x'
    }
  }
}

function createFfmpeg(config) {
  if (ffmpegProcess) {
    throw new Error(
      'FFmpeg is already running.',
    )
  }

  const args =
    buildFfmpegArgs(config)

  console.log(
    '[MSS] Starting FFmpeg',
  )

  const executable =
    process.env.FFMPEG_PATH ||
    'ffmpeg'

  ffmpegProcess =
    spawn(
      executable,
      args,
      {
        stdio: [
          'ignore',
          'pipe',
          'pipe',
          'pipe',
          'pipe',
        ],

        windowsHide: true,
      },
    )

  ffmpegProcess.once(
  'spawn',
  () => {
    console.log(
      '[MSS] FFmpeg process started successfully.',
    )
  },
)

  streamStartedAt =
    Date.now()

  ffmpegProcess.stdout.on(
    'data',
    (data) => {
      parseProgress(
        data.toString(),
      )
    },
  )

  ffmpegProcess.stderr.on(
    'data',
    (data) => {
      const text =
        data.toString().trim()

      if (!text) {
        return
      }

      lastFfmpegError = text

      console.log(
        `[FFmpeg] ${text}`,
      )
    },
  )

  ffmpegProcess.on(
    'error',
    (error) => {
      console.error(
        '[MSS] FFmpeg error:',
        error,
      )

      lastFfmpegError =
        error.message

      stopFfmpeg()
    },
  )

  ffmpegProcess.on(
    'close',
    (code) => {
      console.log(
        `[MSS] FFmpeg exited: ${code}`,
      )

      ffmpegProcess =
        null

      if (streamPort) {
        try {
          streamPort.close()
        } catch {}
      }

      streamPort = null
      streamSessionId = null
    },
  )
}

function createStreamPort() {
  if (!mainWindow) {
    throw new Error(
      'Electron window does not exist.',
    )
  }

  const {
    port1,
    port2,
  } =
    new MessageChannelMain()

  streamPort =
    port1

  streamPort.start()

  streamPort.on(
    'message',
    (event) => {
      const data =
        event.data

      if (
        !data ||
        !ffmpegProcess
      ) {
        return
      }

      if (
        data.type !== 'video' &&
        data.type !== 'audio'
      ) {
        return
      }

      if (
        !data.buffer
      ) {
        return
      }

      const targetPipe =
        data.type === 'video'
          ? ffmpegProcess.stdio[3]
          : ffmpegProcess.stdio[4]

      if (
        !targetPipe ||
        targetPipe.destroyed
      ) {
        return
      }

      try {
        const buffer =
          Buffer.from(
            data.buffer,
          )

        targetPipe.write(
          buffer,
        )

        streamPort?.postMessage({
          type: 'ack',
          kind: data.type,
        })
      } catch (error) {
        console.error(
          '[MSS] Pipe write failed:',
          error,
        )
      }
    },
  )

  /*
   * Send MessagePort to renderer.
   */
  mainWindow.webContents.postMessage(
    'stream-port',
    null,
    [port2],
  )
}

ipcMain.handle(
  'stream:start',
  async (_event, config) => {
    try {
      if (ffmpegProcess) {
        throw new Error(
          'Streaming is already running.',
        )
      }

      lastFfmpegError = ''

      streamSessionId =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`

      createFfmpeg(config)

      /*
       * Give FFmpeg a short moment to spawn.
       * If the executable cannot start,
       * the error handler will reject startup.
       */
      await new Promise(
        (resolve, reject) => {
          if (!ffmpegProcess) {
            reject(
              new Error(
                'FFmpeg process was not created.',
              ),
            )
            return
          }

          let settled = false

          const cleanup = () => {
            ffmpegProcess?.removeListener(
              'spawn',
              onSpawn,
            )

            ffmpegProcess?.removeListener(
              'error',
              onError,
            )
          }

          const onSpawn = () => {
            if (settled) return

            settled = true
            cleanup()
            resolve()
          }

          const onError = (
            error,
          ) => {
            if (settled) return

            settled = true
            cleanup()

            reject(error)
          }

          ffmpegProcess.once(
            'spawn',
            onSpawn,
          )

          ffmpegProcess.once(
            'error',
            onError,
          )
        },
      )

      createStreamPort()

      console.log(
        '[MSS] Native streaming session created:',
        streamSessionId,
      )

      return {
        ok: true,
        sessionId:
          streamSessionId,
      }
    } catch (error) {
      console.error(
        '[MSS] Failed to start streaming:',
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : String(error)

      stopFfmpeg()

      return {
        ok: false,
        error: message,
      }
    }
  },
)

ipcMain.handle(
  'stream:stop',
  async () => {
    stopFfmpeg()

    return {
      ok: true,
    }
  },
)

ipcMain.handle(
  'stream:status',
  async () => {
    return {
      running:
        Boolean(ffmpegProcess),

      uptime:
        streamStartedAt
          ? Math.floor(
              (Date.now() -
                streamStartedAt) /
                1000,
            )
          : 0,

      fps:
        streamStats.fps,

      bitrate:
        streamStats.bitrate,

      speed:
        streamStats.speed,

      error:
        lastFfmpegError,
    }
  },
)

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
