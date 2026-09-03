# Multi Stream Studio

An ultra-lightweight, self-hosted, web-based live streaming studio. Compose
scenes from images, video/audio clips, and text; mix audio; and stream to
multiple platforms (YouTube, Facebook, Twitch, Kick, or any custom RTMP
server) **at the same time**, from a single encode, powered entirely by
FFmpeg.

No OBS, no browser capture hacks, no bundled Electron app - just Node.js,
FFmpeg, and a vanilla-JS UI. Total runtime dependencies: `express`,
`express-session`, `bcryptjs`, `multer`.

## How it works

The server keeps your scenes/sources/settings in a small JSON file
(`server/data/db.json` - no database server to install). When you click
**Start Streaming**, it builds a single FFmpeg command that:

1. Composites every visible source in the active scene into one video
   frame with `-filter_complex` (`scale` + `overlay` for images/video,
   `drawtext` for text).
2. Mixes the audio of every media source together with `amix`.
3. Encodes that once, using whatever encoder/rate-control/preset you
   picked in **Settings → Output**.
4. Fans the single encoded stream out to every platform you've enabled,
   using FFmpeg's `tee` muxer - one encode, N destinations, instead of
   spinning up a separate FFmpeg process per platform.

This is real end-to-end streaming: the pixels the browser shows you in
the Workspace are the same coordinates FFmpeg uses to composite the
outgoing stream (the workspace scales everything to/from your chosen
output resolution).

## Requirements

- Node.js 18+
- **FFmpeg** installed and on your `PATH` (`ffmpeg -version` should work).
  Build it with the encoders you plan to use - e.g. `libx264`/`libx265`
  are in virtually every FFmpeg build; NVIDIA/QSV/AMD hardware encoders
  need a build compiled with those enabled and the right drivers
  installed.

## Setup

```bash
npm install
npm start
```

Then open **http://localhost:4000** and log in with:

- Username: `admin`
- Password: `admin`

Change this immediately in **Menu → Settings → Authorization**.

Set a different port with `PORT=8080 npm start`, and point `FFMPEG_PATH`
at a specific binary if it's not on your `PATH`.

## Using it

1. **Settings → Video**: pick your output resolution and FPS.
2. **Settings → Output**: pick Simple or Advanced encoding.
   - Advanced dynamically shows only the Rate Control / Preset /
     Profile / Tune options that the selected encoder actually
     supports.
   - The single "Bitrate" field is reused as the CRF/QP/CQ value when
     you pick a rate-control mode that uses one instead of a literal
     bitrate - the field label updates to say which.
3. **Editor → Scenes**: add a scene, then **Sources**: add Image /
   Media / Text sources. Drag them around and resize them directly on
   the Workspace - the little handle in the corner resizes, the body
   drags.
4. **Editor → Platforms → +**: takes you to **Settings → Stream**.
   Pick YouTube/Facebook/Twitch/Kick (server URL fills in and is
   locked) or RTMP (enter your own server + a name for it), paste your
   stream key, and hit **Add Service**. Toggle the checkbox next to a
   platform in the list to include/exclude it from the next stream
   without deleting it.
5. Hit **Start Streaming**. The status bar at the bottom shows Live/
   Offline and uptime.

## Known, intentional limitations

This is deliberately a single small Node process with no message
queue, no GPU-accelerated browser compositor, and no per-viewer
transcoding - that's what keeps it "ultra-lightweight". Trade-offs that
follow from that:

- **Editing while live restarts the encoder.** Changing the active
  scene, or adding/moving/resizing a source, tears down and rebuilds
  the FFmpeg process, causing a brief (sub-second to ~1s) gap in the
  outgoing stream. A hot-swappable filter graph is a natural next step
  if you want to extend this.
- **Non-looped clips aren't auto-removed when they finish.** If a
  Media source's "Loop" box isn't checked and the clip ends before you
  stop streaming, FFmpeg will hit end-of-stream on that input. Enable
  Loop for anything that needs to run the whole broadcast (background
  video, looping music, etc).
- **The Audio Mixer's Mute button is local-monitoring only**, exactly
  as specified: it silences the source in your browser's Workspace
  preview but does **not** remove it from the server-side stream mix.
  Volume affects both the local preview and the actual stream.
- **Known-service RTMP ingest URLs may drift.** YouTube/Facebook/
  Twitch/Kick occasionally change their ingest endpoints; the built-in
  defaults (`server/routes/platforms.js`) are believed correct as of
  writing but you should double check against each platform's current
  dashboard if a stream fails to connect. RTMP (custom) never has this
  problem since you type the server yourself.
- **Single operator.** There's one user account (Settings →
  Authorization lets you change its username/password). This isn't
  built for multi-user access control.

## Project layout

```
server/
  index.js                 Express app, sessions, static files
  db.js                    JSON-file "database" + defaults
  auth.js                  Login/session middleware
  ffmpeg/
    engine.js               Builds & runs the FFmpeg command, tracks status
    encoderCapabilities.js  Which Rate Control/Preset/Profile/Tune options
                             are valid per encoder
  routes/
    auth.js, scenes.js, sources.js, platforms.js, settings.js, stream.js
public/
  login.html, index.html
  css/style.css
  js/api.js, app.js, workspace.js, editor.js, settings.js
```

## Extending

- **Custom fonts for Text sources**: drop a `.ttf` file into
  `server/assets/fonts/<FontFamily>.ttf`, then use `<FontFamily>` as
  the Font Family value on a Text source - `engine.js`'s `findFont()`
  looks there first before falling back to a system font.
- **More encoders/services**: everything encoder-related lives in
  `server/ffmpeg/encoderCapabilities.js`; every RTMP service default
  lives in `server/routes/platforms.js`.

## License

MIT
