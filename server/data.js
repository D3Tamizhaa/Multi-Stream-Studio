const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const DEFAULTS = {
  users: [{ username: 'admin', password: 'admin' }],
  scenes: [
    { id: 'scene-1', name: 'Scene 1', sources: [] }
  ],
  activeSceneId: 'scene-1',
  platforms: [], // {id, service, name, server, key, enabled}
  settings: {
    stream: { service: 'YouTube', server: '', key: '', customName: '' },
    output: {
      mode: 'Simple',
      simple: { videoEncoder: 'H.264', videoBitrate: 2500, audioEncoder: 'AAC', audioBitrate: 160, preset: 'Fast' },
      advanced: {
        audio: { encoder: 'AAC', bitrate: 160 },
        video: {
          encoder: 'H.264', rateControl: 'CBR', bitrate: 2500,
          keyframeInterval: 2, preset: 'Fast', profile: 'High', tune: 'None'
        }
      }
    },
    audio: { sampleRate: '48 kHz', channels: 'Stereo' },
    video: {
      baseResolution: '1920x1080', baseCustom: { width: 1920, height: 1080 },
      outputResolution: '1280x720', outputCustom: { width: 1280, height: 720 },
      fps: 30
    },
    advanced: { autoReconnect: true, network: { bindIP: 'Default' } }
  }
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(DEFAULTS, null, 2));
}

function readAll() {
  ensure();
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function writeAll(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function update(mutator) {
  const db = readAll();
  mutator(db);
  writeAll(db);
  return db;
}

module.exports = { readAll, writeAll, update };
