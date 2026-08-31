const express = require('express');
const router = express.Router();
const store = require('../store');
const streamManager = require('../ffmpeg/streamManager');

router.get('/status', (req, res) => {
  res.json(streamManager.getStatus());
});

router.post('/start', (req, res) => {
  try {
    const scenesData = store.getScenes();
    const scene = scenesData.scenes.find((s) => s.id === scenesData.activeSceneId);
    if (!scene) return res.status(400).json({ error: 'No active scene set' });
    const platforms = store.getPlatforms().platforms;
    const settings = store.getSettings();
    const result = streamManager.start({ scene, platforms, settings });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/stop', (req, res) => {
  streamManager.stop();
  res.json({ ok: true });
});

module.exports = router;
