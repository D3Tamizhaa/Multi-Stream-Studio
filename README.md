# Multi Stream Studio

An ultra-lightweight, self-hosted, multi-platform live streaming studio with a
web UI — think a minimal OBS Studio you run on a server. **Zero npm
dependencies.** The entire backend uses only Node.js built-in modules
(`http`, `fs`, `crypto`, `child_process`, `url`), and the frontend is plain
HTML/CSS/JS with no build step, framework, or bundler. The streaming engine
is built entirely around **FFmpeg**, which composites your scene in real
time and streams it live to one or more platforms simultaneously (YouTube,
Facebook, Twitch, Kick, or any custom RTMP server) using FFmpeg's `tee`
muxer — true end-to-end streaming, not just local recording.

## Requirements

- Node.js 18+
- FFmpeg installed and available on `PATH` (`ffmpeg -version` should work).
  For hardware encoders (NVENC/QSV/AMF) your FFmpeg build and drivers must
  support them.

## Running it

```bash
npm start
# or simply: node server.js
```

Then open `http://localhost:8080` (set `PORT=xxxx` to change the port).

**Default login:** `admin` / `admin` — change this immediately under
**Settings → Authorization**.

All application state (users, scenes, sources, platforms, settings) is
persisted to `data/db.json`, a plain JSON file — no database server
required. Uploaded media lives in `uploads/`.

## How the pieces fit together

```
server.js              HTTP server + REST API routing (no framework)
lib/db.js               JSON-file datastore + password hashing (scrypt)
lib/auth.js              Cookie session management
lib/multipart.js         Hand-rolled multipart/form-data parser (file uploads)
lib/encoders.js           Encoder capability map (drives dynamic Output UI + real ffmpeg args)
lib/ffmpeg.js             Builds the FFmpeg filter graph from your scene & spawns/manages the live process
public/                  Static single-page app (no build step)
  index.html              App shell: login + editor + settings routes
  css/style.css           Styling
  js/api.js               Thin fetch() wrapper around the REST API
  js/editor.js             Scenes / Sources / Audio Mixer / Platforms / draggable workspace
  js/settings.js            Authorization / Stream / Output / Audio / Video / Advanced pages
  js/app.js                 Login flow, routing, header/menu, stream status polling
```

## How streaming actually works

1. The **Workspace** is a fixed 16:9 logical canvas (1280×720 coordinate
   space) where you drag/resize Image, Media, and Text sources.
2. When you click **Start Streaming**, the server reads your active scene
   and builds a single FFmpeg command:
   - A `color` source forms the base canvas at your configured output
     resolution (scaled up/down from the 1280×720 editor space).
   - Each visible Image/Media source becomes an FFmpeg input, scaled and
     composited with `overlay` filters in scene order (bottom to top).
   - Each visible Text source is rendered with `drawtext` on top of the
     composited video.
   - Media/audio sources are mixed with `amix` (or passed straight through
     if there's exactly one), respecting per-source Volume/Mute from the
     Audio Mixer. If no source produces audio, a silent track is generated
     so the stream always has an audio channel.
   - The composited video + mixed audio are encoded once (per your Output
     settings) and sent to **every enabled platform simultaneously** via
     FFmpeg's `-f tee` muxer — one encode, multiple RTMP destinations.
3. **Stop Streaming** sends `SIGINT` to FFmpeg for a clean shutdown
   (falling back to `SIGKILL` after 5s).
4. The status bar polls `/api/stream/status` every 1.5s for uptime and
   live/idle/error state.

## Encoder options

`lib/encoders.js` is the single source of truth for which Rate Control /
Preset / Profile / Tune options are shown for each Video Encoder in the
Output settings UI, and it's also what `lib/ffmpeg.js` uses to build real
FFmpeg arguments (`libx264`, `libx265`, `libvpx-vp9`, `libaom-av1`,
`libsvtav1`, `h264_nvenc`/`hevc_nvenc`/`av1_nvenc`, `h264_qsv`/`hevc_qsv`/
`av1_qsv`, `h264_amf`/`hevc_amf`, `mpeg4`, `mpeg2video`, or `copy`/None).

These mappings are practical approximations chosen to produce a working
stream on common hardware — refine the flags in `buildVideoRateArgs` /
`buildVideoEncoderArgs` in `lib/ffmpeg.js` for your exact FFmpeg build if
you need bit-exact behavior (e.g. more precise NVENC `-rc`/`-cq` tuning).

## Platforms

- **YouTube / Facebook / Twitch / Kick**: pick the service, paste your
  Stream Key — the RTMP(S) server URL is filled in automatically and isn't
  editable.
- **RTMP**: enter a custom Server + Stream Key, plus a **Service Name**
  that's what shows up in the Platforms panel.
- Kick's ingest endpoint can vary — double-check the current URL from your
  Kick dashboard and use the **RTMP** option if the built-in default
  doesn't match.
- Multiple platforms can be enabled at once; disabled platforms are simply
  skipped when building the `tee` output list.

## Security notes

This is designed for a single trusted operator running the server on
their own machine/VPS. A few things worth knowing before exposing it
beyond `localhost`:

- Sessions are in-memory (a server restart logs everyone out).
- Stream keys are stored in plaintext in `data/db.json` (needed to build
  the FFmpeg command) — keep that file private and restrict filesystem
  permissions accordingly.
- Put this behind HTTPS (e.g. a reverse proxy) if you access it over a
  network you don't fully trust, since login credentials are sent over
  whatever protocol you serve the app with.

## Known simplifications

- The multipart parser is intentionally minimal (built for browser-style
  file uploads); it isn't a fully RFC 7578–compliant implementation.
- `data/db.json` is read/written synchronously — fine for a single
  operator's low write-frequency use, not designed for high concurrency.
- Text source `font=` uses Fontconfig name lookup — install the font
  family you type, or it'll fall back to FFmpeg's default.
