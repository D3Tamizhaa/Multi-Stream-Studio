// lib/db.js
// Zero-dependency JSON-file "database". Keeps this project ultra-lightweight
// (no SQLite/Mongo/Postgres binaries or drivers required).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}

function defaultData() {
  return {
    user: {
      username: 'admin',
      passwordHash: hashPassword('admin')
    },
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    scenes: [
      { id: 'scene-default', name: 'Scene 1', sources: [] }
    ],
    activeSceneId: 'scene-default',
    platforms: [],
    settings: {
      output: {
        mode: 'simple', // simple | advanced
        simple: {
          videoEncoder: 'x264',
          videoBitrate: 2500,
          audioEncoder: 'aac',
          audioBitrate: 160,
          preset: 'veryfast'
        },
        advanced: {
          video: {
            encoder: 'x264',
            rateControl: 'CBR',
            bitrate: 2500,
            keyframeInterval: 2,
            preset: 'veryfast',
            profile: 'high',
            tune: 'none'
          },
          audio: {
            encoder: 'aac',
            bitrate: 160
          }
        }
      },
      audio: {
        sampleRate: 48000,
        channels: 'stereo'
      },
      video: {
        resolution: '1920x1080',
        customWidth: 1920,
        customHeight: 1080,
        fps: 30
      },
      advanced: {
        autoReconnect: true,
        network: {
          bindIP: 'default'
        }
      }
    }
  };
}

let cache = null;

function ensureLoaded() {
  if (cache) return cache;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    cache = defaultData();
    save();
  } else {
    try {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error('Failed to parse db.json, reinitializing with defaults.', e);
      cache = defaultData();
      save();
    }
  }
  return cache;
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function get() {
  return ensureLoaded();
}

function persist() {
  save();
}

module.exports = { get, persist, hashPassword, verifyPassword };
