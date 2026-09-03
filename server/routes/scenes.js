const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const engine = require('../ffmpeg/engine');

const router = express.Router();

router.get('/', (req, res) => {
  const state = db.get();
  res.json({ scenes: state.scenes.sort((a, b) => a.order - b.order), activeSceneId: state.activeSceneId });
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Scene name is required.' });
  const state = db.get();
  if (state.scenes.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'A scene with that name already exists.' });
  }
  const scene = { id: crypto.randomUUID(), name: name.trim(), order: state.scenes.length };
  db.set((s) => {
    s.scenes.push(scene);
    if (!s.activeSceneId) s.activeSceneId = scene.id;
  });
  res.status(201).json({ scene });
});

router.delete('/:id', (req, res) => {
  const state = db.get();
  if (state.scenes.length <= 1) return res.status(400).json({ error: 'At least one scene is required.' });
  db.set((s) => {
    s.scenes = s.scenes.filter((sc) => sc.id !== req.params.id);
    s.sources = s.sources.filter((src) => src.sceneId !== req.params.id);
    if (s.activeSceneId === req.params.id) s.activeSceneId = s.scenes[0].id;
  });
  engine.restartIfLive();
  res.json({ ok: true });
});

router.post('/:id/rename', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Scene name is required.' });
  const state = db.get();
  if (state.scenes.some((s) => s.id !== req.params.id && s.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'A scene with that name already exists.' });
  }
  db.set((s) => {
    const scene = s.scenes.find((sc) => sc.id === req.params.id);
    if (scene) scene.name = name.trim();
  });
  res.json({ ok: true });
});

router.post('/:id/move', (req, res) => {
  const { direction } = req.body || {}; // 'up' | 'down'
  db.set((s) => {
    const sorted = s.scenes.sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((sc) => sc.id === req.params.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const tmp = sorted[idx].order;
    sorted[idx].order = sorted[swapIdx].order;
    sorted[swapIdx].order = tmp;
  });
  res.json({ ok: true });
});

router.post('/:id/activate', (req, res) => {
  const state = db.get();
  if (!state.scenes.some((s) => s.id === req.params.id)) return res.status(404).json({ error: 'Scene not found.' });
  db.set((s) => { s.activeSceneId = req.params.id; });
  engine.restartIfLive();
  res.json({ ok: true });
});

module.exports = router;
