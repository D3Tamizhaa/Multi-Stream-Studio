import { spawn } from 'node:child_process'

let ffmpegProcess = null

export function isStreaming() {
  return Boolean(ffmpegProcess)
}

export function startStreaming(platforms, settings = {}) {
  if (ffmpegProcess) {
    throw new Error('A stream is already running')
  }

  if (!platforms?.length) {
    throw new Error('No enabled streaming platforms')
  }

  const outputs = platforms
    .filter(
      (platform) =>
        platform.enabled &&
        platform.server &&
        platform.streamKey,
    )
    .map((platform) => {
      const destination =
        `${platform.server.replace(/\/+$/, '')}/${platform.streamKey}`

      return `[f=flv:onfail=ignore]${destination}`
    })

  if (!outputs.length) {
    throw new Error(
      'No enabled platform has a valid server and stream key',
    )
  }

  const width =
    Number(settings.video?.outputResolution?.split('x')[0]) || 1920

  const height =
    Number(settings.video?.outputResolution?.split('x')[1]) || 1080

  const fps =
    Number.parseInt(settings.video?.fps, 10) || 30

  const bitrate =
    Number.parseInt(settings.output?.bitrate, 10) || 6000

  const audioBitrate =
    Number.parseInt(settings.audio?.bitrate, 10) || 160

  const keyframeInterval =
    Number.parseInt(settings.output?.keyframeInterval, 10) || 2

  const teeOutput = outputs.join('|')

  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',

    // Browser MediaRecorder sends WebM to stdin.
    '-f',
    'webm',
    '-i',
    'pipe:0',

    // Video
    '-map',
    '0:v:0',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-tune',
    'zerolatency',
    '-pix_fmt',
    'yuv420p',

    '-vf',
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,

    '-r',
    String(fps),

    '-g',
    String(fps * keyframeInterval),

    '-keyint_min',
    String(fps * keyframeInterval),

    '-b:v',
    `${bitrate}k`,

    '-maxrate',
    `${bitrate}k`,

    '-bufsize',
    `${bitrate * 2}k`,

    // Audio, if the captured stream has one.
    '-map',
    '0:a?',
    '-c:a',
    'aac',
    '-b:a',
    `${audioBitrate}k`,
    '-ar',
    '48000',
    '-ac',
    '2',

    '-flags',
    '+global_header',

    '-f',
    'tee',
    teeOutput,
  ]

  console.log(
    'Starting FFmpeg outputs:',
    platforms
      .filter((platform) => platform.enabled)
      .map((platform) => platform.name),
  )

  ffmpegProcess = spawn('ffmpeg', args, {
    stdio: ['pipe', 'ignore', 'pipe'],
  })

  ffmpegProcess.stderr.on('data', (data) => {
    console.log(`[FFmpeg] ${data.toString().trim()}`)
  })

  ffmpegProcess.on('error', (error) => {
    console.error('FFmpeg process error:', error)
    ffmpegProcess = null
  })

  ffmpegProcess.on('close', (code, signal) => {
    console.log(
      `FFmpeg stopped. code=${code}, signal=${signal}`,
    )

    ffmpegProcess = null
  })

  return ffmpegProcess
}

export function writeStreamChunk(chunk) {
  if (!ffmpegProcess?.stdin?.writable) {
    return false
  }

  return ffmpegProcess.stdin.write(chunk)
}

export function stopStreaming() {
  if (!ffmpegProcess) {
    return
  }

  try {
    ffmpegProcess.stdin.end()
  } catch {
    // Ignore stdin close errors.
  }

  setTimeout(() => {
    if (ffmpegProcess) {
      ffmpegProcess.kill('SIGTERM')
      ffmpegProcess = null
    }
  }, 3000)
}
