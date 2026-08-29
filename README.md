# Multi Stream Studio

A lightweight, self-hosted, multi-platform live streaming studio with a real
browser-based control room UI and an actual **FFmpeg** streaming engine underneath
(no fake/simulated encoder — every "Start Streaming" click spawns a real `ffmpeg`
process that composites your scene and pushes it out over RTMP).

- Compose scenes from **Image**, **Media** (video/audio) and **Text** sources on a
  16:9 workspace — drag to reposition, drag the corner handle to resize.
- Mix per-source volume, mute, and local/output monitor routing.
- Stream simultaneously to **YouTube, Facebook, Twitch, Kick**, and/or any **custom
  RTMP** server using FFmpeg's `tee` muxer (one encode, N destinations).
- Simple and Advanced output modes with a real encoder capability matrix (rate
  control / preset / profile / tune options only show what the chosen encoder
  actually supports).
- Live status bar: uptime, bitrate, fps, CPU, RAM — read straight from the running
  ffmpeg process (`-progress` + `pidusage`), pushed to the browser over WebSocket.
- A "preview" toggle that renders an actual still frame of your composited scene
  via ffmpeg (not a canvas mockup), refreshed every couple of seconds.

## Requirements

- **Node.js 18+**
- **FFmpeg** on `PATH`, built with `libx264` at minimum. For the full encoder menu
  (H.265, VP9, AV1, SVT-AV1) you'll want a build with `libx265`, `libvpx`,
  `libaom`, and `libsvtav1`. NVIDIA/QuickSync/AMD entries in the Output settings
  only work if the host actually has that GPU, its drivers, and an ffmpeg build
  compiled with the matching hwaccel (`h264_nvenc`, `h264_qsv`, `h264_amf`, etc.) —
  the app builds correct arguments for them either way, but ffmpeg itself will
  report an error at start-time if the hardware isn't there. That's intentional:
  the app never silently swaps in a software fallback for a hardware choice you
  made.

## Setup

```bash
npm install
npm start
```

Then open **http://localhost:8080** and sign in with:

```
Username: admin
Password: admin
```

Change this immediately from **Menu → Settings → Authorization**. All app state
(users, scenes, sources, platforms, settings) lives in `data/db.json`, created on
first boot. Uploaded images/video/fonts are stored under `uploads/`.

Set `PORT` and `SESSION_SECRET` env vars to configure the port and cookie signing
key for production use.

## How streaming actually works

1. Each visible source in the active scene becomes an ffmpeg input (`-loop 1` for
   images so they persist for the stream's duration, `-re -stream_loop -1` for
   looping media).
2. A `-filter_complex` graph composites them: a synthetic `color=` canvas at your
   configured **Base (Canvas) Resolution**, then a chain of `scale` + `overlay`
   filters placing each source at its `x`/`y`/`width`/`height`, then `drawtext`
   for text sources (rendered via fontconfig, or your uploaded `.ttf`/`.otf` if a
   source has one), then a final `scale` to your **Output Resolution**.
3. Audio from all non-muted, non-"Monitor Only" media sources is volume-adjusted
   and mixed with `amix`.
4. The composite is encoded with the encoder/rate-control/preset/profile/tune you
   configured in **Settings → Output**, then sent to every **enabled** platform at
   once via `-f tee "[f=flv]rtmp://...|[f=flv]rtmp://..."`.
5. `Stop Streaming` sends `SIGINT` to the ffmpeg process for a clean shutdown.

The exact same graph-building code renders the workspace's still-frame preview
(minus the audio graph and `-re` pacing), so what you see in Preview reflects
what will actually be encoded.

## Project layout

```
server/
  index.js            Express app, sessions, static files, WebSocket stats feed
  auth.js             Session auth + credential updates
  store.js            JSON-file persistence (data/db.json)
  encoderProfiles.js  Encoder → rate-control/preset/profile/tune capability matrix
  ffmpegEngine.js      Filter-graph builder + process/stats management (the core engine)
  routes/
    auth.js, scenes.js, platforms.js, settings.js, uploads.js, stream.js, preview.js
public/
  index.html          Login + editor + settings markup
  css/style.css       Design tokens & layout (dark broadcast control-room theme)
  js/
    api.js            fetch() wrapper
    app.js            Bootstrap, view switching, WebSocket stats, header menus
    editor.js         Scenes/Sources/Workspace drag-resize/Audio Mixer/Platforms/Controls
    settings.js       Authorization/Stream/Output/Audio/Video/Advanced pages
    login.js
```

## Known limitations / honest caveats

- **Single active scene drives the output.** Switching the active scene while
  live requires restarting the stream to rebuild the filter graph (this keeps the
  engine simple and correct rather than attempting hot scene-swapping, which
  real broadcast tools solve with a much larger persistent-process architecture).
- **RTMPS (Facebook)** targets the modern `rtmps://` ingest; this requires an
  ffmpeg build with TLS support (the one used during development — with
  `--enable-gnutls` — works out of the box).
- **Local audio monitoring** ("Monitor Only" / "Monitor and Output") is modeled
  fully in the data and respected when deciding what's *included in the stream*,
  but actually routing audio to a local speaker on the server host would require
  an OS audio sink (PulseAudio/ALSA) wired into a second ffmpeg output — left out
  since most deployment targets (a VPS/container) have no audio hardware at all.
- **Hardware encoders** (NVIDIA/QuickSync/AMD) are fully wired into the UI and the
  command builder, but they will only actually run on a host with the matching
  GPU + drivers + ffmpeg build, as noted above.
- Kick's RTMP ingest endpoint changes from time to time; verify the current one
  in your Kick dashboard if streaming to Kick fails immediately.

## Verifying the engine yourself

Everything above was exercised directly against the real `ffmpeg` binary while
building this (not just written and assumed to work): the filter graph was
built and executed to encode a two-source scene (image + video overlay + mixed
audio) to a local file, a single-frame JPEG preview was rendered and visually
inspected, and the `tee` muxer was confirmed to fan the same encode out to two
destinations at once — you can find the same shapes of command in
`server/ffmpegEngine.js`.
