'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function defaultDb() {
  return {
    auth: {
      username: 'admin',
      // default password: admin
      passwordHash: bcrypt.hashSync('admin', 10)
    },
    scenes: [
      { id: 'scene-1', name: 'Scene 1', sources: [] }
    ],
    activeSceneId: 'scene-1',
    platforms: [],
    settings: {
      output: {
        mode: 'Simple',
        simple: { videoEncoder: 'H.264', videoBitrate: 2500, audioEncoder: 'AAC', audioBitrate: 160, preset: 'Very Fast' },
        advanced: {
          audio: { encoder: 'AAC', bitrate: 160 },
          video: {
            encoder: 'H.264', rateControl: 'CBR', bitrate: 2500, keyframeInterval: 2,
            preset: 'Very Fast', profile: 'High', tune: 'None'
          }
        }
      },
      audio: { sampleRate: '48 kHz', channels: 'Stereo' },
      video: {
        baseResolution: '1920x1080', baseCustom: { width: 1920, height: 1080 },
        outputResolution: '1920x1080', outputCustom: { width: 1920, height: 1080 },
        fps: 30
      },
      advanced: { autoReconnect: true, network: { bindIp: 'Default', interfaceName: '' } }
    }
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb(), null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/** Run a mutation against the db and persist the result. */
function update(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result !== undefined ? result : db;
}

module.exports = { readDb, writeDb, update, DATA_DIR };
