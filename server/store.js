// Minimal JSON-file backed data store. No external DB needed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcryptLike = require('./util/simpleHash');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  scenes: path.join(DATA_DIR, 'scenes.json'),
  platforms: path.join(DATA_DIR, 'platforms.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[store] failed reading ${file}, using fallback:`, e.message);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ---- defaults / seed ----
const defaultUsers = () => ({
  users: [{ id: 'u1', username: 'admin', passwordHash: bcryptLike.hash('admin') }],
});

const defaultScenes = () => ({
  activeSceneId: 'scene-1',
  scenes: [
    { id: 'scene-1', name: 'Scene 1', sources: [] },
  ],
});

const defaultPlatforms = () => ({ platforms: [] });

const defaultSettings = () => ({
  stream: { services: [] }, // {id, service, server, streamKey, name(optional, for RTMP), enabled}
  output: {
    mode: 'simple', // simple | advanced
    simple: {
      video: { encoder: 'H.264', bitrate: 2500 },
      audio: { encoder: 'AAC', bitrate: 160 },
      preset: 'Medium',
    },
    advanced: {
      audio: { encoder: 'AAC', bitrate: 160 },
      video: {
        encoder: 'H.264',
        rateControl: 'CBR',
        bitrate: 2500,
        keyframeInterval: 2,
        preset: 'Medium',
        profile: 'High',
        tune: 'None',
      },
    },
  },
  audio: { sampleRate: '48 kHz', channels: 'Stereo' },
  video: { resolution: '1920x1080', customWidth: 1920, customHeight: 1080, fps: 30 },
  advanced: { autoReconnect: true, network: { bindIp: 'Default', maxBitrateBurst: 0 } },
});

function ensureSeed() {
  if (!fs.existsSync(FILES.users)) writeJson(FILES.users, defaultUsers());
  if (!fs.existsSync(FILES.scenes)) writeJson(FILES.scenes, defaultScenes());
  if (!fs.existsSync(FILES.platforms)) writeJson(FILES.platforms, defaultPlatforms());
  if (!fs.existsSync(FILES.settings)) writeJson(FILES.settings, defaultSettings());
}
ensureSeed();

const db = {
  // generic
  id: () => crypto.randomBytes(6).toString('hex'),

  // users
  getUsers: () => readJson(FILES.users, defaultUsers()),
  saveUsers: (data) => writeJson(FILES.users, data),

  // scenes/sources
  getScenes: () => readJson(FILES.scenes, defaultScenes()),
  saveScenes: (data) => writeJson(FILES.scenes, data),

  // platforms (the "Platforms" panel entries, linked to a stream service)
  getPlatforms: () => readJson(FILES.platforms, defaultPlatforms()),
  savePlatforms: (data) => writeJson(FILES.platforms, data),

  // settings
  getSettings: () => readJson(FILES.settings, defaultSettings()),
  saveSettings: (data) => writeJson(FILES.settings, data),
};

module.exports = db;
