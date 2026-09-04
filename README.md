# Multi Stream Studio

An ultra-lightweight, self-hosted, browser-based live streaming studio. It composites
image / video / text sources into a single scene and pushes the result to **multiple
RTMP platforms simultaneously** (YouTube, Facebook, Twitch, Kick, or a manual RTMP
server), all driven by **FFmpeg**.

No database server, no build step, no bundler. Just Node.js + FFmpeg.

## Features

- Username/password login (default `admin` / `admin`, changeable in Settings)
- Drag-and-resize Workspace editor (16:9), matching the actual FFmpeg output
- Scenes (add / remove / rename / reorder) and per-scene Sources
  - **Image**: PNG, JPG, JPEG, GIF, TGA, BMP
  - **Media**: MP4, MP3, WEBM (with loop option)
  - **Text**: font family/size/color, freely positioned
- Per-source lock / show-hide / reorder / properties
- Audio Mixer with per-source volume and local mute
- Multiple simultaneous RTMP destinations via FFmpeg's `tee` muxer
- Simple and Advanced output modes with a real encoder capability map
  (Rate Control / Preset / Profile / Tune options are filtered to match
  whichever encoder you pick)
- Live status bar (Idle / Starting / Live / Reconnecting / Error) and uptime,
  pushed over WebSocket
- Auto-reconnect option

## Requirements

- Node.js 18+
- **FFmpeg** installed and available on `PATH` (`ffmpeg -version` should work).
  For hardware encoders (NVENC / QSV / AMF) you need an FFmpeg build compiled
  with that support, plus the relevant GPU drivers.

## Setup

```bash
npm install
npm start
```

Then open `http://localhost:8787` and log in with `admin` / `admin`.

Set a custom port with `PORT=9000 npm start`.

## Project layout

```
server.js            Express app + WebSocket status broadcast
lib/db.js             Tiny JSON-file "database" (data/db.json)
lib/auth.js            Stateless signed-cookie session auth
lib/ffmpeg.js           Encoder capability map + filter_complex/tee command builder + process manager
routes/                 REST API (auth, scenes, upload, platforms, settings, stream)
public/                 Static frontend (vanilla HTML/CSS/JS, no framework/build step)
  index.html             Login page
  studio.html            Main app shell (Editor + Settings views)
  js/api.js               Thin fetch/XHR wrapper (incl. upload progress)
  js/workspace.js          Canvas rendering + drag/resize for sources
  js/settings.js           Settings forms (Authorization/Stream/Output/Audio/Video/Advanced)
  js/app.js                Main app orchestration (scenes, sources, platforms, controls, status)
data/                   JSON database lives here at runtime (gitignored)
uploads/                Uploaded image/media files live here at runtime (gitignored)
```

## How streaming works

On **Start Streaming**, the server builds a single FFmpeg command:

1. A `color` lavfi input is the base canvas at your configured resolution/FPS.
2. Each visible source becomes an input (`-loop 1` for images, `-stream_loop -1`
   for looping media) and is chained into a `filter_complex` graph:
   `scale` + `overlay` for images/video, `drawtext` for text, in your Sources
   list order (bottom of the graph = first item).
3. Unmuted media sources are mixed into a single audio track with `amix`
   (or silence via `anullsrc` if nothing has audio).
4. The composited output is encoded per your Output settings and sent to
   every **enabled** platform at once via `-f tee`, so one encode fans out to
   several RTMP endpoints without re-encoding per destination.

## Known limitations (by design, given project scope)

- **Video encoder "None" (copy)** isn't really compatible with real-time
  compositing — since sources are always scaled/overlaid, there's no original
  encoded stream left to "copy" once you have more than a trivial single
  source. Use an actual encoder for anything beyond quick testing.
- **Text `Font Family`** by name requires an FFmpeg build with `fontconfig`
  support. If your FFmpeg lacks it, switch to a `fontfile=` path (small code
  change in `lib/ffmpeg.js`).
- Video-track detection for Media sources is done by file extension
  (`.mp3` = audio-only, `.mp4`/`.webm` = has video) rather than probing the
  file, to keep the dependency list minimal (no `ffprobe` calls).
- Rate-control/keyframe/preset/profile/tune options are mapped per encoder
  family but aren't exhaustively validated against every FFmpeg build's
  compiled-in feature set — mismatched hardware encoder options will surface
  as an FFmpeg error at stream-start time.
- This is a single-tenant/local-admin tool: one user account, JSON-file
  storage, no HTTPS termination built in (put it behind a reverse proxy for
  remote/production use).

## Security notes

- Change the default `admin` / `admin` credentials immediately (Settings →
  Authorization).
- Sessions are a signed, httpOnly cookie (HMAC-SHA256) — no session store
  dependency required, but this also means changing `data/db.json`'s
  `sessionSecret` field invalidates all existing sessions.
- Run this behind HTTPS (e.g. a reverse proxy like Caddy/nginx) if exposing
  it beyond localhost, since login credentials are sent over plain HTTP
  otherwise.
