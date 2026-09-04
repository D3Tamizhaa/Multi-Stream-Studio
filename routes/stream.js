const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/status', (req, res) => {
  const engine = req.app.get('engine');
  res.json(engine.snapshot());
});

router.post('/start', (req, res) => {
  const engine = req.app.get('engine');
  const uploadsDir = req.app.get('uploadsDir');
  const data = db.get();

  const scene = data.scenes.find(s => s.id === data.activeSceneId) || data.scenes[0];
  const enabledPlatforms = data.platforms.filter(p => p.enabled);
  const rtmpTargets = enabledPlatforms.map(p => {
    const server = p.server.endsWith('/') ? p.server.slice(0, -1) : p.server;
    return `${server}/${p.key}`;
  });

  try {
    const snapshot = engine.start({
      scene,
      settings: data.settings,
      uploadsDir,
      rtmpTargets,
      autoReconnect: !!data.settings.advanced.autoReconnect
    });
    res.json(snapshot);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/stop', (req, res) => {
  const engine = req.app.get('engine');
  engine.stop();
  res.json({ ok: true });
});

module.exports = router;
