import http from 'node:http'
import { spawn } from 'node:child_process'

let ffmpegProcess = null

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })

  res.end(JSON.stringify(data))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (error) {
        reject(error)
      }
    })

    req.on('error', reject)
  })
}

function buildOutputUrl(platform) {
  const server = platform.server.trim()
  const key = platform.streamKey.trim()

  if (!server || !key) {
    throw new Error(
      `${platform.name}: server and stream key are required.`,
    )
  }

  return `${server.replace(/\/+$/, '')}/${key}`
}

function parseResolution(value, fallback) {
  const match = String(value || '').match(
    /^(\d+)x(\d+)$/,
  )

  if (!match) return fallback

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

function buildFfmpegArgs(config) {
  const videoResolution = parseResolution(
    config.video.outputResolution,
    {
      width: 1920,
      height: 1080,
    },
  )

  const fps =
    Number.parseFloat(config.video.fps) || 30

  const bitrate =
    Number.parseInt(config.output.bitrate, 10) || 6000

  const audioBitrate =
    Number.parseInt(config.audio.bitrate, 10) || 160

  const keyframeInterval =
    Number.parseInt(
      config.output.keyframeInterval,
      10,
    ) || 2

  const gop = Math.max(
    1,
    Math.round(fps * keyframeInterval),
  )

  const outputs = config.platforms
    .filter(
      (platform) =>
        platform.enabled &&
        platform.server &&
        platform.streamKey,
    )
    .map((platform) => {
      const url = buildOutputUrl(platform)

      return (
        `[f=flv:onfail=ignore]${url}`
      )
    })

  if (outputs.length === 0) {
    throw new Error(
      'No enabled streaming platforms.',
    )
  }

  return [
    '-hide_banner',
    '-loglevel',
    'warning',

    '-fflags',
    '+genpts',

    '-i',
    'pipe:0',

    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',

    '-c:v',
    'libx264',
    '-preset',
    config.output.preset || 'veryfast',
    '-tune',
    config.output.tune === 'None'
      ? 'zerolatency'
      : config.output.tune || 'zerolatency',

    '-profile:v',
    String(config.output.profile || 'High').toLowerCase(),

    '-pix_fmt',
    'yuv420p',

    '-vf',
    `scale=${videoResolution.width}:${videoResolution.height}`,

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

    '-c:a',
    'aac',

    '-b:a',
    `${audioBitrate}k`,

    '-ar',
    '48000',

    '-ac',
    '2',

    '-flvflags',
    'no_duration_filesize',

    '-f',
    'tee',

    outputs.join('|'),
  ]
}

export async function startStream(config) {
  if (ffmpegProcess) {
    throw new Error('FFmpeg is already running.')
  }

  const args = buildFfmpegArgs(config)

  console.log(
    'Starting FFmpeg:',
    ['ffmpeg', ...args].join(' '),
  )

  ffmpegProcess = spawn('ffmpeg', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  ffmpegProcess.stdout.on('data', (data) => {
    console.log(
      '[FFmpeg stdout]',
      data.toString(),
    )
  })

  ffmpegProcess.stderr.on('data', (data) => {
    console.log(
      '[FFmpeg]',
      data.toString(),
    )
  })

  ffmpegProcess.on('close', (code) => {
    console.log(
      `FFmpeg exited with code ${code}`,
    )

    ffmpegProcess = null
  })

  ffmpegProcess.on('error', (error) => {
    console.error(
      'FFmpeg process error:',
      error,
    )

    ffmpegProcess = null
  })
}

export function writeStreamChunk(chunk) {
  if (!ffmpegProcess?.stdin?.writable) {
    throw new Error(
      'FFmpeg input is not available.',
    )
  }

  return ffmpegProcess.stdin.write(chunk)
}

export function stopStream() {
  if (!ffmpegProcess) return

  try {
    ffmpegProcess.stdin.end()
  } catch {}

  try {
    ffmpegProcess.kill('SIGTERM')
  } catch {}

  ffmpegProcess = null
}

export function createStreamRoutes(req, res) {
  if (
    req.method === 'OPTIONS'
  ) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type',
    })

    res.end()
    return true
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/stream/start'
  ) {
    readJson(req)
      .then(async (config) => {
        await startStream(config)

        sendJson(res, 200, {
          ok: true,
        })
      })
      .catch((error) => {
        console.error(
          'Stream start error:',
          error,
        )

        sendJson(res, 500, {
          ok: false,
          error: error.message,
        })
      })

    return true
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/stream/input'
  ) {
    if (!ffmpegProcess) {
      sendJson(res, 409, {
        ok: false,
        error: 'FFmpeg is not running.',
      })

      return true
    }

    req.on('data', (chunk) => {
      try {
        writeStreamChunk(chunk)
      } catch (error) {
        console.error(
          'FFmpeg input error:',
          error,
        )
      }
    })

    req.on('end', () => {
      if (ffmpegProcess) {
        try {
          ffmpegProcess.stdin.end()
        } catch {}
      }

      sendJson(res, 200, {
        ok: true,
      })
    })

    req.on('error', (error) => {
      console.error(
        'Stream input error:',
        error,
      )

      stopStream()
    })

    return true
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/stream/stop'
  ) {
    stopStream()

    sendJson(res, 200, {
      ok: true,
    })

    return true
  }

  return false
}
