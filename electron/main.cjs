const {
  app,
  BrowserWindow,
  ipcMain,
  MessageChannelMain,
} = require('electron')

const path = require('node:path')
const { spawn } = require('node:child_process')
const os = require('node:os')

let mainWindow = null
let ffmpegProcess = null
let streamPort = null
let streamSessionId = null
let streamStartedAt = null

let streamStats = {
  fps: 0,
  bitrate: '0 kbits/s',
  speed: '0x',
}

let lastFfmpegError = ''

function parseResolution(value) {
  const match = String(value || '')
    .match(/^(\d+)x(\d+)$/)

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

function getVideoEncoder(value) {
  const encoder = String(value || '')
    .toLowerCase()

  if (
    encoder.includes('nvenc') ||
    encoder.includes('nvidia')
  ) {
    return 'h264_nvenc'
  }

  if (
    encoder.includes('amf') ||
    encoder.includes('amd')
  ) {
    return 'h264_amf'
  }

  if (
    encoder.includes('qsv') ||
    encoder.includes('intel')
  ) {
    return 'h264_qsv'
  }

  return 'libx264'
}

function getAudioEncoder(value) {
  const encoder = String(value || '')
    .toLowerCase()

  if (
    encoder === 'aac' ||
    encoder.includes('aac')
  ) {
    return 'aac'
  }

  return 'aac'
}

function buildOutputUrl(platform) {
  const server = String(
    platform.server || '',
  ).trim()

  const streamKey = String(
    platform.streamKey || '',
  ).trim()

  if (!server) {
    throw new Error(
      `${platform.name}: RTMPS server is missing.`,
    )
  }

  if (!streamKey) {
    throw new Error(
      `${platform.name}: stream key is missing.`,
    )
  }

  return (
    `${server.replace(/\/+$/, '')}/` +
    encodeURIComponent(streamKey)
  )
}

function buildFfmpegArgs(config) {
  const resolution =
    parseResolution(
      config.video?.outputResolution,
    )

  /*
   * The program canvas is always 1920x1080.
   * FFmpeg performs the final output scaling.
   */
  const inputWidth = 1920
  const inputHeight = 1080

  const fps = Math.max(
    1,
    Number.parseInt(
      config.video?.fps,
      10,
    ) || 30,
  )

  const bitrate = Math.max(
    500,
    Number.parseInt(
      config.output?.bitrate,
      10,
    ) || 6000,
  )

  const audioBitrate = Math.max(
    64,
    Number.parseInt(
      config.audio?.bitrate,
      10,
    ) || 160,
  )

  const keyframeInterval =
    Math.max(
      1,
      Number.parseInt(
        config.output?.keyframeInterval,
        10,
      ) || 2,
    )

  const gop =
    Math.round(
      fps * keyframeInterval,
    )

  const videoEncoder =
    getVideoEncoder(
      config.output?.encoder,
    )

  const audioEncoder =
    getAudioEncoder(
      config.audio?.encoder,
    )

  const platforms = Array.isArray(
    config.platforms,
  )
    ? config.platforms.filter(
        (platform) =>
          platform?.enabled &&
          String(
            platform.server || '',
          ).trim() &&
          String(
            platform.streamKey || '',
          ).trim(),
      )
    : []

  if (platforms.length === 0) {
    throw new Error(
      'No enabled streaming platform has a server and stream key.',
    )
  }

  const outputs = platforms.map(
    (platform) => {
      const url =
        buildOutputUrl(platform)

      console.log(
        `[Stream] ${platform.name} -> ${url.replace(
          encodeURIComponent(
            platform.streamKey,
          ),
          '********',
        )}`,
      )

      return `[f=flv:onfail=ignore]${url}`
    },
  )

  const args = [
    '-hide_banner',

    '-loglevel',
    'info',

    '-nostats',

    /*
     * FFmpeg progress is sent to stdout.
     */
    '-progress',
    'pipe:1',

    /*
     * PROGRAM VIDEO
     *
     * Renderer sends raw RGBA frames through
     * Electron MessagePort -> native pipe 3.
     */
    '-thread_queue_size',
    '512',

    '-f',
    'rawvideo',

    '-pixel_format',
    'rgba',

    '-video_size',
    `${inputWidth}x${inputHeight}`,

    '-framerate',
    String(fps),

    '-i',
    'pipe:3',

    /*
     * PROGRAM AUDIO
     *
     * Renderer sends raw signed 16-bit stereo
     * PCM through native pipe 4.
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
     * Stream selection.
     */
    '-map',
    '0:v:0',

    '-map',
    '1:a:0',

    /*
     * VIDEO ENCODING
     */
    '-c:v',
    videoEncoder,

    '-preset',
    config.output?.preset ||
      'veryfast',

    '-tune',
    config.output?.tune &&
    config.output.tune !== 'None'
      ? config.output.tune
      : 'zerolatency',

    '-profile:v',
    String(
      config.output?.profile ||
        'high',
    ).toLowerCase(),

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

    /*
     * CBR.
     */
    '-b:v',
    `${bitrate}k`,

    '-minrate',
    `${bitrate}k`,

    '-maxrate',
    `${bitrate}k`,

    '-bufsize',
    `${bitrate * 2}k`,

    /*
     * AUDIO ENCODING
     */
    '-c:a',
    audioEncoder,

    '-b:a',
    `${audioBitrate}k`,

    '-ar',
    '48000',

    '-ac',
    '2',

    /*
     * RTMP/FLV output.
     */
    '-flvflags',
    'no_duration_filesize',

    '-f',
    'tee',

    outputs.join('|'),
  ]

  return args
}

function resetStreamState() {
  if (streamPort) {
    try {
      streamPort.close()
    } catch {}
  }

  streamPort = null
  streamSessionId = null
  streamStartedAt = null

  streamStats = {
    fps: 0,
    bitrate: '0 kbits/s',
    speed: '0x',
  }

  lastFfmpegError = ''
}

function stopFfmpeg() {
  const processRef =
    ffmpegProcess

  ffmpegProcess = null

  if (!processRef) {
    resetStreamState()
    return
  }

  try {
    processRef.stdio[3]?.destroy()
  } catch {}

  try {
    processRef.stdio[4]?.destroy()
  } catch {}

  try {
    processRef.kill(
      process.platform === 'win32'
        ? undefined
        : 'SIGTERM',
    )
  } catch {}

  resetStreamState()
}

function parseProgress(text) {
  const lines =
    String(text)
      .split(/\r?\n/)

  for (const line of lines) {
    const separator =
      line.indexOf('=')

    if (separator < 0) {
      continue
    }

    const key =
      line.slice(0, separator)

    const value =
      line.slice(separator + 1)

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
    '[Stream] Starting native FFmpeg:',
  )

  console.log(
    ['ffmpeg', ...args]
      .join(' ')
      .replace(
        /([?&]?(?:key|stream_key)=)[^&\s]+/gi,
        '$1********',
      ),
  )

  const processRef =
    spawn(
      process.env.FFMPEG_PATH ||
        'ffmpeg',
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

  ffmpegProcess =
    processRef

  streamStartedAt =
    Date.now()

  processRef.stdout.on(
    'data',
    (data) => {
      parseProgress(
        data.toString(),
      )
    },
  )

  processRef.stderr.on(
    'data',
    (data) => {
      const text =
        data.toString()

      lastFfmpegError =
        text.trim()

      console.log(
        `[FFmpeg] ${text.trim()}`,
      )
    },
  )

  processRef.on(
    'error',
    (error) => {
      console.error(
        '[FFmpeg] Process error:',
        error,
      )

      lastFfmpegError =
        error.message

      stopFfmpeg()
    },
  )

  processRef.on(
    'close',
    (code, signal) => {
      console.log(
        `[FFmpeg] exited code=${code} signal=${signal || 'none'}`,
      )

      if (
        code !== 0 &&
        code !== null
      ) {
        console.error(
          '[FFmpeg] Streaming stopped:',
          lastFfmpegError,
        )
      }

      ffmpegProcess = null
      resetStreamState()
    },
  )

  return processRef
}

function createStreamPort() {
  if (!mainWindow) {
    throw new Error(
      'Electron main window is not available.',
    )
  }

  const {
    port1,
    port2,
  } = new MessageChannelMain()

  streamPort =
    port1

  streamPort.start()

  streamPort.on(
    'message',
    (event) => {
      const data =
        event.data

      if (!ffmpegProcess) {
        return
      }

      if (
        data?.type !== 'video' &&
        data?.type !== 'audio'
      ) {
        return
      }

      const buffer =
        data.buffer

      if (!(buffer instanceof ArrayBuffer)) {
        return
      }

      const pipe =
        data.type === 'video'
          ? ffmpegProcess.stdio[3]
          : ffmpegProcess.stdio[4]

      if (!pipe?.writable) {
        return
      }

      try {
        const nodeBuffer =
          Buffer.from(buffer)

        const canContinue =
          pipe.write(
            nodeBuffer,
          )

        /*
         * Tell renderer that FFmpeg accepted
         * the binary block.
         */
        streamPort?.postMessage({
          type: 'ack',
          kind: data.type,
          accepted: canContinue,
        })
      } catch (error) {
        console.error(
          `[Stream] Failed writing ${data.type} to FFmpeg:`,
          error,
        )
      }
    },
  )

  streamPort.on(
    'close',
    () => {
      console.log(
        '[Stream] Renderer stream port closed.',
      )
    },
  )

  mainWindow.webContents.postMessage(
    'stream-port',
    streamSessionId,
    [port2],
  )
}

ipcMain.handle(
  'stream:start',
  async (event, config) => {
    if (ffmpegProcess) {
      throw new Error(
        'Streaming is already running.',
      )
    }

    try {
      createFfmpeg(config)

      streamSessionId =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`

      createStreamPort()

      return {
        ok: true,
        sessionId:
          streamSessionId,
      }
    } catch (error) {
      stopFfmpeg()

      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
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

function createWindow() {
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

  const devUrl =
    'http://127.0.0.1:5173'

  const productionFile =
    path.join(
      app.getAppPath(),
      'dist',
      'index.html',
    )

  const loadApplication =
    async () => {
      if (
        process.env.NODE_ENV ===
          'production' ||
        require('node:fs').existsSync(
          productionFile,
        )
      ) {
        await mainWindow.loadFile(
          productionFile,
        )

        return
      }

      for (
        let attempt = 0;
        attempt < 30;
        attempt++
      ) {
        try {
          await mainWindow.loadURL(
            devUrl,
          )

          return
        } catch {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                250,
              ),
          )
        }
      }

      throw new Error(
        'Could not connect to Vite at http://127.0.0.1:5173',
      )
    }

  loadApplication().catch(
    (error) => {
      console.error(
        '[Electron] Failed to load application:',
        error,
      )
    },
  )

  mainWindow.on(
    'closed',
    () => {
      stopFfmpeg()
      mainWindow = null
    },
  )
}

app.whenReady().then(() => {
  createWindow()

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
})

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
