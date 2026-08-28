# Multi Stream Studio

A lightweight, self-hosted, web-based multi-platform live streaming studio —
an OBS-style scene/source editor in the browser, backed by a real FFmpeg
streaming engine on the server that pushes RTMP to YouTube, Facebook, Twitch,
Kick, or any custom RTMP endpoint.

## How the streaming pipeline actually works

Browsers can't run FFmpeg or open raw RTMP sockets, so this app splits the
work between the browser and the server, and the video that reaches your
streaming platform is a **real encode of what's on the Workspace**, not a
placeholder:

1. **Compositing (browser):** every source in the active scene (image,
   video, text) is drawn every frame onto a hidden `<canvas>` sized to your
   Base Resolution — this is the actual picture that gets streamed.
2. **Capture (browser):** `canvas.captureStream()` grabs that canvas as a
   live video track. Audio from Media sources is routed through the Web
   Audio API (per-source gain nodes = the Audio Mixer's volume/mute
   controls) into a `MediaStreamDestination`, then combined with the video
   track.
3. **Encode + transport (browser → server):** `MediaRecorder` encodes the
   combined stream to WebM (VP9/Opus) in small chunks and ships them over a
   WebSocket (`/ws/ingest`) to the server as they're produced.
4. **FFmpeg (server):** `server/streamManager.js` spawns a real `ffmpeg`
   process, feeding it the incoming WebM chunks on `stdin`, transcoding to
   whatever you configured in Output Settings (H.264/H.265/VP9/AV1/etc.,
   your bitrate/rate-control/preset/profile/tune), and pushing the result
   out via RTMP. When more than one platform is enabled, one FFmpeg process
   encodes once and fans out to every platform using the `tee` muxer.
5. **Live stats:** FFmpeg's own stderr progress (`fps=`, `bitrate=`) plus
   server CPU/RAM are broadcast over `/ws/stats` and drive the bottom status
   bar and Live/Offline pill.

## Requirements

- Node.js 18+
- **FFmpeg installed and on `PATH`** (`ffmpeg -version` should work). Only
  the software encoders (`libx264`, `libx265`, `libvpx-vp9`, `libaom-av1`,
  `libsvtav1`, `mpeg4`, `mpeg2video`) work on any machine. The
  NVIDIA/QSV/AMD hardware encoders in the Output settings require a
  matching GPU/driver **and** an FFmpeg build compiled with that encoder —
  they'll fail with a clear FFmpeg error at stream-start if unavailable.

## Setup

```bash
npm install
npm start
# open http://localhost:3000
```

Default login: `admin` / `admin` — change it under the user menu →
Authorization Settings (this is the only settings page that isn't a
one-click Apply/Cancel save-to-JSON; it also updates your session).

All app data (users, scenes, sources, platforms, settings) is persisted in
`data/db.json`. Uploaded images/media land in `uploads/`.

## Known limitations (by design, not bugs)

- **Browser Source composite:** a cross-origin iframe's pixels cannot be
  read into a `<canvas>` for security reasons (the same restriction OBS
  works around with its own embedded browser engine, which is out of scope
  for a lightweight web app). Browser sources render live for editing in
  the Workspace, but appear as a labeled placeholder box in the actual
  outgoing stream. Same-origin/self-hosted HTML widgets you control could
  be adapted to post pixel data back via `postMessage` + `drawImage` if you
  need this to be pixel-perfect.
- **Hardware encoders** depend entirely on the host machine's GPU, drivers,
  and FFmpeg build — this app exposes the full option list from the spec,
  but can't guarantee any given hardware encoder is actually available.
- **Monitor and Output / Monitor Only** audio modes are stored per-source
  and reflected in the UI; only the "Monitor and Output" / default routing
  is wired into the actual outgoing mix in this build — true local-only
  monitoring (audio you hear but that never reaches the stream) would need
  a second audio graph tap, which is a straightforward extension of
  `public/js/streaming.js`.
- Uses cookie-based sessions with a default dev secret — set
  `SESSION_SECRET` in your environment before exposing this beyond
  localhost, and put it behind HTTPS/a reverse proxy for real deployments
  (RTMP stream keys are sensitive).

## Project layout

```
server/
  index.js          Express app entry, sessions, static + API mounting
  auth.js            login / logout / authorization settings
  api.js             scenes, sources, platforms, settings, stream control
  data.js            JSON file persistence (data/db.json)
  streamManager.js   FFmpeg process lifecycle, arg building, stats parsing
  wsHandlers.js       /ws/ingest (video in) and /ws/stats (stats out)
  ffmpegMaps.js      encoder/rate-control/preset/profile/tune capability maps
  upload.js          multer config for Image/Media source uploads
public/
  index.html         login screen + full app shell
  css/style.css
  js/
    api.js           fetch wrapper
    workspace.js      DOM editor + canvas compositor (the actual video source)
    streaming.js      MediaRecorder capture, WS ingest, audio mixing
    settingsForms.js  Stream/Output/Audio/Video/Advanced/Authorization forms
    modal.js          add-scene / add-source / add-platform / properties dialogs
    app.js            navigation, CRUD wiring, status bar
```
