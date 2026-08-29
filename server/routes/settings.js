'use strict';

const express = require('express');
const auth = require('../auth');
const store = require('../store');
const encoderProfiles = require('../encoderProfiles');

const router = express.Router();
router.use(auth.requireAuth);

router.get('/', (req, res) => {
  const db = store.readDb();
  res.json({ settings: db.settings });
});

router.get('/encoders', (req, res) => {
  const shape = {};
  for (const name of encoderProfiles.listVideoEncoders()) {
    const e = encoderProfiles.getVideoEncoder(name);
    shape[name] = {
      rateControl: e.rateControl,
      keyframeInterval: e.keyframeInterval,
      presets: e.presets,
      profiles: e.profiles,
      tunes: e.tunes
    };
  }
  res.json({ video: shape, audio: encoderProfiles.listAudioEncoders() });
});

function deepMerge(target, patch) {
  for (const key of Object.keys(patch || {})) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key]) && target[key]) {
      deepMerge(target[key], patch[key]);
    } else {
      target[key] = patch[key];
    }
  }
  return target;
}

router.put('/output', (req, res) => {
  const result = store.update((db) => { deepMerge(db.settings.output, req.body || {}); return { settings: db.settings }; });
  res.json(result);
});

router.put('/audio', (req, res) => {
  const result = store.update((db) => { deepMerge(db.settings.audio, req.body || {}); return { settings: db.settings }; });
  res.json(result);
});

router.put('/video', (req, res) => {
  const result = store.update((db) => { deepMerge(db.settings.video, req.body || {}); return { settings: db.settings }; });
  res.json(result);
});

router.put('/advanced', (req, res) => {
  const result = store.update((db) => { deepMerge(db.settings.advanced, req.body || {}); return { settings: db.settings }; });
  res.json(result);
});

module.exports = router;
