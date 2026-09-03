/**
 * Ultra-lightweight JSON-file "database".
 * No native/compiled dependencies - just fs. Good enough for a
 * single-operator streaming studio (low write frequency, small data).
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function defaultState() {
  return {
    user: {
      username: 'admin',
      // default password: admin
      passwordHash: bcrypt.hashSync('admin', 10)
    },
    scenes: [
      { id: 'scene-default', name: 'Scene 1', order: 0 }
    ],
    activeSceneId: 'scene-default',
    sources: [],
    platforms: [],
    output: {
      mode: 'simple',
      simple: {
        videoEncoder: 'H.264',
        videoBitrate: 2500,
        audioEncoder: 'AAC',
        audioBitrate: 160,
        preset: 'Very Fast'
      },
      advanced: {
        video: {
          encoder: 'H.264',
          rateControl: 'CBR',
          bitrate: 2500,
          keyframeInterval: 2,
          preset: 'Very Fast',
          profile: 'High',
          tune: 'None'
        },
        audio: {
          encoder: 'AAC',
          bitrate: 160
        }
      }
    },
    video: {
      resolution: '1280x720',
      customWidth: 1280,
      customHeight: 720,
      fps: 30
    },
    audio: {
      sampleRate: 48000,
      channels: 'Stereo'
    },
    advanced: {
      autoReconnect: true,
      network: {
        bindIp: '',
        maxBitrateBurst: 0
      }
    }
  };
}

let state = null;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    state = defaultState();
    save();
  } else {
    try {
      state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      console.error('Failed to parse db.json, resetting to defaults:', err.message);
      state = defaultState();
      save();
    }
  }
  return state;
}

function save() {
  ensureDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function get() {
  if (!state) load();
  return state;
}

function set(mutatorFn) {
  const s = get();
  mutatorFn(s);
  save();
  return s;
}

module.exports = { get, set, load, save, UPLOADS_DIR, DATA_DIR };
