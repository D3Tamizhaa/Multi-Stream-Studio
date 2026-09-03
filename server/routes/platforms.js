const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const engine = require('../ffmpeg/engine');

const router = express.Router();

// Best-effort default ingest servers for the built-in services. These
// occasionally change upstream - Settings > Stream lets the operator
// see the resolved value, and RTMP (custom) always allows manual entry.
const SERVICE_DEFAULTS = {
  youtube: { label: 'YouTube', server: 'rtmp://a.rtmp.youtube.com/live2' },
  facebook: { label: 'Facebook', server: 'rtmps://live-api-s.facebook.com:443/rtmp' },
  twitch: { label: 'Twitch', server: 'rtmp://live.twitch.tv/app' },
  kick: { label: 'Kick', server: 'rtmp://1935.kick.com/live' }
};

router.get('/service-defaults', (req, res) => res.json(SERVICE_DEFAULTS));

router.get('/', (req, res) => {
  res.json({ platforms: db.get().platforms });
});

router.post('/', (req, res) => {
  const { service, streamKey, server, customName } = req.body || {};
  if (!service) return res.status(400).json({ error: 'Service is required.' });
  if (service === 'rtmp' && !customName) return res.status(400).json({ error: 'Service Name is required for a custom RTMP destination.' });
  if (service !== 'rtmp' && !SERVICE_DEFAULTS[service]) return res.status(400).json({ error: 'Unknown service.' });

  const platform = {
    id: crypto.randomUUID(),
    service,
    name: service === 'rtmp' ? customName : SERVICE_DEFAULTS[service].label,
    server: service === 'rtmp' ? server : SERVICE_DEFAULTS[service].server,
    streamKey: streamKey || '',
    enabled: true
  };
  db.set((s) => s.platforms.push(platform));
  res.status(201).json({ platform });
});

router.patch('/:id', (req, res) => {
  const editable = ['streamKey', 'server', 'customName', 'enabled', 'name'];
  const state = db.get();
  const platform = state.platforms.find((p) => p.id === req.params.id);
  if (!platform) return res.status(404).json({ error: 'Platform not found.' });
  db.set((s) => {
    const target = s.platforms.find((p) => p.id === req.params.id);
    for (const key of editable) {
      if (req.body[key] !== undefined) target[key] = req.body[key];
    }
    if (req.body.customName) target.name = req.body.customName;
  });
  if (req.body.enabled !== undefined) engine.restartIfLive();
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.set((s) => { s.platforms = s.platforms.filter((p) => p.id !== req.params.id); });
  engine.restartIfLive();
  res.json({ ok: true });
});

module.exports = router;
