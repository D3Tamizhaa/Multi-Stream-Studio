function buildFfmpegArguments(config) {
  const args = []

  args.push(...config.inputArgs)

  // video input
  args.push(
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-video_size',
    `${config.video.width}x${config.video.height}`,
    '-framerate',
    String(config.video.fps),
    '-i',
    'pipe:0',
  )

  if (config.audio.enabled) {
    // Audio input will be changed to a second pipe
    // once the audio transport is separated.
  }

  args.push(...config.videoArgs)

  args.push(...config.audioArgs)

  args.push(...config.advancedArgs)

  for (const output of config.outputs) {
    args.push(
      '-f',
      'flv',
      output.url,
    )
  }

  return args
}

module.exports = {
  buildFfmpegArguments,
}
