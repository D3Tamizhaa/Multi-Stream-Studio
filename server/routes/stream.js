const express = require('express');
const engine = require('../ffmpeg/engine');

const router = express.Router();

router.get('/status', (req, res) => res.json(engine.getStatus()));

router.post('/start', (req, res) => {
  const result = engine.start();
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post('/stop', (req, res) => {
  const result = engine.stop();
  res.json(result);
});

module.exports = router;
