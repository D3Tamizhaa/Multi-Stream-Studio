# Multi Stream Studio

A browser-based live production studio interface for managing scenes,
sources, audio, streaming platforms and output settings.

## Features

### Authentication

- Login / Sign in screen
- Username
- Password
- Local prototype authentication

### Editor

- Live editing canvas
- Preview enable / disable
- Scene management
- Source management
- Source visibility
- Source locking
- Source properties
- Source ordering
- Audio mixer
- Platform management
- Streaming controls
- Usage statistics

### Scenes

- Add scene
- Remove scene
- Select scene
- Move scene up
- Move scene down

### Sources

Supported source types:

- Image
- Browser Source
- Media File
- Text (GDI+)

Image formats:

- PNG
- JPG
- JPEG
- GIF
- TGA
- BMP

Browser sources:

- Websites
- Third-party widgets
- HTML
- Custom CSS

Media:

- MP4
- MP3
- WebM
- Loop

Text:

- Font family
- Font size
- Text
- Color
- Width
- Height

### Audio Mixer

- Volume
- Mute / Unmute
- Properties

### Platforms

Supported platform types:

- YouTube
- Facebook
- Twitch
- Kick
- Custom

Each platform supports:

- Enable / disable
- Server
- Stream key
- Edit

### Controls

- Start Streaming
- End Streaming

### Usage

- Uptime
- Bitrate
- FPS
- CPU
- RAM
- Status

### Settings

#### Authorization

- Username
- Password

#### Stream

- Service
- Server
- Stream key

#### Output

- Encoder
- Rate Control
- Bitrate
- Keyframe Interval
- Preset
- Profile
- Tune

#### Audio

- Encoder
- Bitrate
- Sample Rate
- Channels

#### Video

- Base Resolution
- Output Resolution
- FPS

#### Advanced

- Automatically Reconnect
- Network

## Tech Stack

- React
- TypeScript
- Vite
- Lucide React
- CSS

## Requirements

Node.js 20+

## Installation

```bash
git clone <your-repository-url>
cd multi-stream-studio
npm install
