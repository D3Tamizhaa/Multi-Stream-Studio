const { spawn } = require('node:child_process')

const ffmpegPath =
  process.env.FFMPEG_PATH || 'ffmpeg'

const child = spawn(
  ffmpegPath,
  ['-version'],
  {
    stdio: 'inherit',
    windowsHide: true,
  },
)

child.on('error', (error) => {
  console.error(
    `Unable to start FFmpeg using "${ffmpegPath}".`,
  )
  console.error(error.message)
  process.exit(1)
})

child.on('close', (code) => {
  process.exit(code ?? 1)
})
