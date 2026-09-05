'use strict';
/**
 * Tiny synchronous JSON file datastore. No dependencies.
 * Good enough for a single-operator streaming studio (low write concurrency).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

function defaultDb() {
  const { salt, hash } = hashPassword('admin');
  return {
    user: { username: 'admin', salt, hash },
    scenes: [
      { id: 'scene-1', name: 'Scene 1', sources: [] }
    ],
    activeSceneId: 'scene-1',
    platforms: [],
    settings: {
      output: {
        mode: 'simple',
        simple: { videoEncoder: 'H.264', videoBitrate: 2500, audioEncoder: 'AAC', audioBitrate: 160, preset: 'Medium' },
        advanced: {
          audio: { encoder: 'AAC', bitrate: 160 },
          video: {
            encoder: 'H.264', rateControl: 'CBR', bitrate: 2500,
            keyframeInterval: 2, preset: 'Medium', profile: 'High', tune: 'None'
          }
        }
      },
      audio: { sampleRate: '48 kHz', channels: 'Stereo' },
      video: { resolution: '1280x720', customWidth: 1280, customHeight: 720, fps: 30 },
      advanced: { autoReconnect: true, network: {} }
    }
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb(), null, 2));
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function write(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = { read, write, hashPassword, verifyPassword };
