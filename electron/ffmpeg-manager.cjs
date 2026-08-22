const { spawn } = require('node:child_process')

class FfmpegManager {
  constructor() {
    this.process = null
    this.stopping = false
    this.startedAt = null
  }

  isRunning() {
    return Boolean(this.process)
  }

  start(config, emit) {
    if (this.process) {
      throw new Error('FFmpeg is already running')
    }

    const args = buildFfmpegArguments(config)

    this.stopping = false
    this.startedAt = Date.now()

    const ffmpegPath =
      process.env.FFMPEG_PATH || 'ffmpeg'

    this.process = spawn(
      ffmpegPath,
      args,
      {
        stdio: [
          'pipe',
          'pipe',
          'pipe',
        ],
        windowsHide: true,
      },
    )

    this.process.stdout.on(
      'data',
      (data) => {
        emit({
          type: 'stdout',
          data: data.toString(),
        })
      },
    )

    this.process.stderr.on(
      'data',
      (data) => {
        emit({
          type: 'stderr',
          data: data.toString(),
        })
      },
    )

    this.process.on(
      'error',
      (error) => {
        emit({
          type: 'error',
          error: error.message,
        })

        this.process = null
      },
    )

    this.process.on(
      'close',
      (code, signal) => {
        const intentional = this.stopping

        this.process = null

        emit({
          type: 'exit',
          code,
          signal,
          intentional,
        })
      },
    )

    return {
      startedAt: this.startedAt,
      args,
    }
  }

  writeVideoFrame(buffer) {
    if (!this.process?.stdin?.writable) {
      return
    }

    this.process.stdin.write(buffer)
  }

  writeAudioChunk(buffer) {
    if (!this.process?.stdin?.writable) {
      return
    }

    this.process.stdin.write(buffer)
  }

  stop() {
    if (!this.process) {
      return
    }

    this.stopping = true

    this.process.kill('SIGTERM')

    setTimeout(() => {
      if (this.process) {
        this.process.kill('SIGKILL')
      }
    }, 5000)
  }

  status() {
    return {
      running: this.isRunning(),
      startedAt: this.startedAt,
    }
  }
}

function buildFfmpegArguments(config) {
  // Implemented in the next section.
  return []
}

module.exports = {
  FfmpegManager,
  buildFfmpegArguments,
}
