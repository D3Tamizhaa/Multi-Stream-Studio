const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../lib/db');

function id() { return `plat-${crypto.randomBytes(6).toString('hex')}`; }

// Known service ingest servers, used to auto-fill the "Server" field in
// Settings > Stream. RTMP stays fully manual per spec.
const SERVICE_TEMPLATES = {
  YouTube: 'rtmp://a.rtmp.youtube.com/live2',
  Facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
  Twitch: 'rtmp://live.twitch.tv/app',
  Kick: 'rtmps://fa723fc1b171.global-contribute.live-video.net/live'
};

router.get('/service-templates', (req, res) => res.json(SERVICE_TEMPLATES));

router.get('/', (req, res) => {
  res.json({ platforms: db.get().platforms });
});

router.post('/', (req, res) => {
  const data = db.get();
  const { service, server, key, rtmpServiceName } = req.body || {};
  if (!['YouTube', 'Facebook', 'Twitch', 'Kick', 'RTMP'].includes(service)) {
    return res.status(400).json({ error: 'Invalid service' });
  }
  if (!key || !key.trim()) return res.status(400).json({ error: 'Stream key is required' });
  if (service === 'RTMP' && (!server || !server.trim())) {
    return res.status(400).json({ error: 'Server is required for a manual RTMP service' });
  }
  if (service === 'RTMP' && (!rtmpServiceName || !rtmpServiceName.trim())) {
    return res.status(400).json({ error: 'Service Name is required for a manual RTMP service' });
  }

  const platform = {
    id: id(),
    service,
    name: service === 'RTMP' ? rtmpServiceName.trim() : service,
    server: service === 'RTMP' ? server.trim() : SERVICE_TEMPLATES[service],
    key: key.trim(),
    enabled: true
  };
  data.platforms.push(platform);
  db.persist();
  res.json({ platform });
});

router.put('/:id', (req, res) => {
  const data = db.get();
  const platform = data.platforms.find(p => p.id === req.params.id);
  if (!platform) return res.status(404).json({ error: 'Platform not found' });
  const { server, key, rtmpServiceName } = req.body || {};
  if (server !== undefined && platform.service === 'RTMP') platform.server = server;
  if (key !== undefined && key.trim()) platform.key = key.trim();
  if (rtmpServiceName !== undefined && platform.service === 'RTMP') platform.name = rtmpServiceName.trim();
  db.persist();
  res.json({ platform });
});

router.delete('/:id', (req, res) => {
  const data = db.get();
  const idx = data.platforms.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Platform not found' });
  data.platforms.splice(idx, 1);
  db.persist();
  res.json({ ok: true });
});

router.post('/:id/toggle', (req, res) => {
  const data = db.get();
  const platform = data.platforms.find(p => p.id === req.params.id);
  if (!platform) return res.status(404).json({ error: 'Platform not found' });
  platform.enabled = !platform.enabled;
  db.persist();
  res.json({ platform });
});

module.exports = router;
