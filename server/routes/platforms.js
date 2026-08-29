'use strict';

const express = require('express');
const crypto = require('crypto');
const auth = require('../auth');
const store = require('../store');
const { platformIngestUrl } = require('../ffmpegEngine');

const router = express.Router();
router.use(auth.requireAuth);

const uid = () => `plat-${crypto.randomBytes(4).toString('hex')}`;

const SERVICE_DEFAULT_SERVERS = {
  YouTube: 'rtmp://a.rtmp.youtube.com/live2',
  Facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
  Twitch: 'rtmp://live.twitch.tv/app',
  Kick: 'rtmp://fa723fc1b171.global-contribute.live-video.net/live'
};

router.get('/', (req, res) => {
  const db = store.readDb();
  // never send raw stream keys back in full over the wire for list views; the UI has an explicit "Show" toggle
  const redacted = db.platforms.map((p) => ({ ...p, streamKey: p.streamKey ? p.streamKey : '' }));
  res.json({ platforms: redacted });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const { service, server, streamKey, name } = body;
  if (!['YouTube', 'Facebook', 'Twitch', 'Kick', 'RTMP'].includes(service)) {
    return res.status(400).json({ error: 'Invalid service.' });
  }
  if (service === 'RTMP' && (!name || !name.trim())) {
    return res.status(400).json({ error: 'A service name is required for custom RTMP.' });
  }
  if (!streamKey && service !== 'RTMP') return res.status(400).json({ error: 'Stream key is required.' });
  const platform = {
    id: uid(),
    service,
    name: service === 'RTMP' ? name.trim() : service,
    server: service === 'RTMP' ? (server || '') : (SERVICE_DEFAULT_SERVERS[service] || ''),
    streamKey: streamKey || '',
    enabled: true
  };
  store.update((db) => db.platforms.push(platform));
  res.status(201).json({ platform });
});

router.put('/:id', (req, res) => {
  const result = store.update((db) => {
    const platform = db.platforms.find((p) => p.id === req.params.id);
    if (!platform) return { error: 'Platform not found.' };
    const body = req.body || {};
    if (body.server !== undefined && platform.service === 'RTMP') platform.server = body.server;
    if (body.streamKey !== undefined) platform.streamKey = body.streamKey;
    if (body.enabled !== undefined) platform.enabled = !!body.enabled;
    if (body.name !== undefined && platform.service === 'RTMP') platform.name = body.name;
    return { platform };
  });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

router.delete('/:id', (req, res) => {
  store.update((db) => { db.platforms = db.platforms.filter((p) => p.id !== req.params.id); });
  res.json({ ok: true });
});

router.get('/:id/preview-url', (req, res) => {
  const db = store.readDb();
  const platform = db.platforms.find((p) => p.id === req.params.id);
  if (!platform) return res.status(404).json({ error: 'Platform not found.' });
  try {
    res.json({ url: platformIngestUrl(platform) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
