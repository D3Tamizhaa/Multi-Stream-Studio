const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { capabilities } = require('../lib/ffmpeg');

router.get('/', (req, res) => {
  res.json({ settings: db.get().settings });
});

router.get('/output/capabilities', (req, res) => {
  res.json(capabilities());
});

router.put('/output', (req, res) => {
  const data = db.get();
  data.settings.output = req.body;
  db.persist();
  res.json({ ok: true, settings: data.settings.output });
});

router.put('/audio', (req, res) => {
  const data = db.get();
  data.settings.audio = req.body;
  db.persist();
  res.json({ ok: true, settings: data.settings.audio });
});

router.put('/video', (req, res) => {
  const data = db.get();
  data.settings.video = req.body;
  db.persist();
  res.json({ ok: true, settings: data.settings.video });
});

router.put('/advanced', (req, res) => {
  const data = db.get();
  data.settings.advanced = req.body;
  db.persist();
  res.json({ ok: true, settings: data.settings.advanced });
});

module.exports = router;
