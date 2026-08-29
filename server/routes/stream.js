'use strict';

const express = require('express');
const path = require('path');
const auth = require('../auth');
const store = require('../store');

module.exports = function createStreamRouter(engine) {
  const router = express.Router();
  router.use(auth.requireAuth);

  router.get('/status', (req, res) => {
    res.json({ live: engine.isLive(), stats: engine.getStats() });
  });

  router.post('/start', (req, res) => {
    if (engine.isLive()) return res.status(409).json({ error: 'Already streaming.' });
    const db = store.readDb();
    const scene = db.scenes.find((s) => s.id === db.activeSceneId) || db.scenes[0];
    if (!scene) return res.status(400).json({ error: 'No active scene.' });
    if (!db.platforms.some((p) => p.enabled)) return res.status(400).json({ error: 'Enable at least one platform before going live.' });
    try {
      const info = engine.start({ scene, settings: db.settings, platforms: db.platforms, uploadsDir: path.join(__dirname, '..', '..', 'uploads') });
      res.json({ ok: true, pid: info.pid });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/stop', (req, res) => {
    const stopped = engine.stop();
    res.json({ ok: stopped });
  });

  router.get('/log', (req, res) => {
    res.type('text/plain').send(engine.getRecentLog());
  });

  return router;
};
