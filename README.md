# Multi Stream Studio

A lightweight, self-hosted multi-platform streaming studio. It's a scene/source
compositor (like a mini OBS) with a web control panel, driven server-side by
**FFmpeg**, which composites your Image / Media / Text sources into one video
feed and fans it out live to multiple platforms (YouTube, Facebook, Twitch,
Kick, or any custom RTMP server) at once.

## Requirements

- Node.js 18+
- **FFmpeg** installed and on your `PATH` (`ffmpeg -version` should work).
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - Windows: install a build from ffmpeg.org and add it to PATH.
  - For hardware encoders (NVENC / QSV / AMF) you need an FFmpeg build with
    those encoders compiled in, plus the matching GPU drivers.

## Install & run

```bash
npm install
npm start
```

Then open **http://localhost:8080**.

Default login: `admin` / `admin` (change it from Menu → Settings → Authorization
after your first login).

## How the streaming pipeline works

1. You build **Scenes**, each containing **Sources** (Image / Media / Text)
   with position, size, and (for media) volume/monitor settings.
2. Whichever scene is marked **active** is what goes out when you hit
   **Start Streaming**.
3. On start, the server builds a single FFmpeg `filter_complex` graph:
   - A black base canvas at your configured output resolution.
   - Each Image/Media source is scaled and `overlay`'d at its `x,y,width,height`.
   - Each Media source's audio is optionally mixed in (`amix`), respecting
     mute/volume/monitor mode.
   - Each Text source is rendered with `drawtext` (font, size, color).
4. The composited output is encoded once (per your Output settings: encoder,
   rate control, bitrate, preset/profile/tune, resolution, fps, audio codec)
   and sent to FFmpeg's `tee` muxer, which duplicates the encoded stream to
   every **enabled** platform's RTMP URL simultaneously — one encode, N
   destinations.
5. Switching the active scene while live gracefully restarts the pipeline
   with the new scene graph (a ~1s hiccup, same as OBS Studio scene collection
   reloads on some transitions-less setups).

All of this happens in `server/ffmpeg/streamManager.js`, which shells out to
the real `ffmpeg` binary — nothing here is mocked or simulated.

## Project layout

```
server/
  index.js               Express + Socket.IO bootstrap
  store.js                Tiny JSON-file data store (no DB server needed)
  middleware/auth.js      JWT cookie auth guard
  ffmpeg/encoderCapabilities.js   Per-encoder valid rate-control/preset/profile/tune options
  ffmpeg/streamManager.js         Builds & runs the FFmpeg command, tracks uptime/status
  routes/                 REST API: auth, scenes, sources, settings, stream, upload
public/
  login.html / js         Login screen
  index.html              App shell (header, menu, workspace, panels, status bar)
  js/app.js               Header/menu/navigation/auth-guard
  js/editor.js             Workspace canvas, scenes, sources, audio mixer, platforms, controls
  js/settings.js           Authorization/Stream/Output/Audio/Video/Advanced settings pages
  js/api.js                Small fetch() wrapper
  css/style.css            All styling
data/                      JSON data files (scenes.json, settings.json, users.json) - auto-created
uploads/                   User-uploaded image/media files
```

## Notes & limits (read this before going live)

- This is a from-scratch MVP, not a drop-in OBS replacement. It covers the
  full UI/workflow you specified, but encoder hardware support depends on
  your FFmpeg build and GPU — verify `ffmpeg -encoders` lists the ones you
  pick before relying on them.
- Only one scene composites to the output at a time (the "active" scene).
  There's no cross-fade transition between scenes yet — switching is a fast
  cut (FFmpeg restart).
- RTMP Stream Keys are stored in `data/settings.json` in plaintext on your
  own machine — keep that file private, same as OBS's `service.json`.
- "Monitor" options describe how a media source's audio is treated in the
  *output mix* (there's no server-side local speaker): **Monitor Off** =
  included in the stream only, **Monitor Only** = excluded from the stream
  (silent to viewers), **Monitor and Output** = included in the stream.
