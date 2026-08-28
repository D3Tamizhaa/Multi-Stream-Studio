const express = require('express');
const { v4: uuid } = require('uuid');
const data = require('./data');
const streamManager = require('./streamManager');
const { requireAuth } = require('./auth');
const { VIDEO_ENCODERS, AUDIO_ENCODERS, SERVICE_SERVERS } = require('./ffmpegMaps');

const router = express.Router();
router.use(requireAuth);

router.get('/maps', (req, res) => {
  res.json({ videoEncoders: VIDEO_ENCODERS, audioEncoders: Object.keys(AUDIO_ENCODERS), services: Object.keys(SERVICE_SERVERS) });
});

// ---- Scenes ----
router.get('/scenes', (req, res) => {
  const db = data.readAll();
  res.json({ scenes: db.scenes, activeSceneId: db.activeSceneId });
});

router.post('/scenes', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Scene name required' });
  const db = data.readAll();
  if (db.scenes.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'A scene with that name already exists' });
  }
  const scene = { id: uuid(), name: name.trim(), sources: [] };
  data.update(d => { d.scenes.push(scene); if (!d.activeSceneId) d.activeSceneId = scene.id; });
  res.json(scene);
});

router.delete('/scenes/:id', (req, res) => {
  const db = data.update(d => {
    d.scenes = d.scenes.filter(s => s.id !== req.params.id);
    if (d.activeSceneId === req.params.id) d.activeSceneId = d.scenes[0] ? d.scenes[0].id : null;
  });
  res.json({ ok: true, activeSceneId: db.activeSceneId });
});

router.post('/scenes/:id/move', (req, res) => {
  const { direction } = req.body || {};
  const db = data.readAll();
  const idx = db.scenes.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Scene not found' });
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= db.scenes.length) return res.json({ ok: true, scenes: db.scenes });
  data.update(d => { [d.scenes[idx], d.scenes[swapWith]] = [d.scenes[swapWith], d.scenes[idx]]; });
  res.json({ ok: true });
});

router.put('/scenes/active/:id', (req, res) => {
  data.update(d => { d.activeSceneId = req.params.id; });
  res.json({ ok: true });
});

// ---- Sources ----
router.post('/scenes/:sceneId/sources', (req, res) => {
  const src = req.body || {};
  if (!src.type || !src.name) return res.status(400).json({ error: 'Source type and name required' });
  const source = {
    id: uuid(), type: src.type, name: src.name,
    x: src.x || 40, y: src.y || 40, width: src.width || 320, height: src.height || 180,
    locked: false, visible: true, props: src.props || {}
  };
  const db = data.update(d => {
    const scene = d.scenes.find(s => s.id === req.params.sceneId);
    if (scene) scene.sources.push(source);
  });
  res.json(source);
});

router.put('/scenes/:sceneId/sources/:sourceId', (req, res) => {
  const db = data.update(d => {
    const scene = d.scenes.find(s => s.id === req.params.sceneId);
    if (!scene) return;
    const src = scene.sources.find(s => s.id === req.params.sourceId);
    if (src) Object.assign(src, req.body || {});
  });
  res.json({ ok: true });
});

router.delete('/scenes/:sceneId/sources/:sourceId', (req, res) => {
  data.update(d => {
    const scene = d.scenes.find(s => s.id === req.params.sceneId);
    if (scene) scene.sources = scene.sources.filter(s => s.id !== req.params.sourceId);
  });
  res.json({ ok: true });
});

router.post('/scenes/:sceneId/sources/:sourceId/move', (req, res) => {
  const { direction } = req.body || {};
  data.update(d => {
    const scene = d.scenes.find(s => s.id === req.params.sceneId);
    if (!scene) return;
    const idx = scene.sources.findIndex(s => s.id === req.params.sourceId);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= scene.sources.length) return;
    [scene.sources[idx], scene.sources[swapWith]] = [scene.sources[swapWith], scene.sources[idx]];
  });
  res.json({ ok: true });
});

// ---- Platforms ----
router.get('/platforms', (req, res) => res.json(data.readAll().platforms));

router.post('/platforms', (req, res) => {
  const { service, name, server, key } = req.body || {};
  const platform = { id: uuid(), service, name: name || service, server, key, enabled: true };
  data.update(d => d.platforms.push(platform));
  res.json(platform);
});

router.put('/platforms/:id', (req, res) => {
  data.update(d => {
    const p = d.platforms.find(p => p.id === req.params.id);
    if (p) Object.assign(p, req.body || {});
  });
  res.json({ ok: true });
});

router.delete('/platforms/:id', (req, res) => {
  data.update(d => { d.platforms = d.platforms.filter(p => p.id !== req.params.id); });
  res.json({ ok: true });
});

// ---- Settings ----
for (const section of ['stream', 'output', 'audio', 'video', 'advanced']) {
  router.get(`/settings/${section}`, (req, res) => res.json(data.readAll().settings[section]));
  router.put(`/settings/${section}`, (req, res) => {
    const db = data.update(d => { d.settings[section] = { ...d.settings[section], ...req.body }; });
    res.json(db.settings[section]);
  });
}

router.get('/settings/servers/:service', (req, res) => {
  res.json({ server: SERVICE_SERVERS[req.params.service] || '' });
});

// ---- Streaming control ----
router.post('/stream/start', (req, res) => {
  const db = data.readAll();
  try {
    streamManager.start(db.settings, db.platforms);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/stream/stop', (req, res) => {
  streamManager.stop();
  res.json({ ok: true });
});

router.get('/stream/status', (req, res) => res.json(streamManager.getStats()));

module.exports = router;
