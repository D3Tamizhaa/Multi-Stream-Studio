const express = require('express');
const db = require('../db');
const engine = require('../ffmpeg/engine');
const caps = require('../ffmpeg/encoderCapabilities');

const router = express.Router();

router.get('/', (req, res) => {
  const state = db.get();
  res.json({ output: state.output, video: state.video, audio: state.audio, advanced: state.advanced });
});

router.get('/output/capabilities', (req, res) => {
  res.json({
    videoEncoders: caps.listVideoEncoders(),
    audioEncoders: caps.listAudioEncoders(),
    encoderInfo: caps.VIDEO_ENCODERS
  });
});

router.put('/output', (req, res) => {
  db.set((s) => { s.output = req.body; });
  engine.restartIfLive();
  res.json({ ok: true });
});

router.put('/video', (req, res) => {
  db.set((s) => { s.video = req.body; });
  engine.restartIfLive();
  res.json({ ok: true });
});

router.put('/audio', (req, res) => {
  db.set((s) => { s.audio = req.body; });
  engine.restartIfLive();
  res.json({ ok: true });
});

router.put('/advanced', (req, res) => {
  db.set((s) => { s.advanced = req.body; });
  res.json({ ok: true });
});

module.exports = router;
