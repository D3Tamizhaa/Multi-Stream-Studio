'use strict';

const express = require('express');
const crypto = require('crypto');
const auth = require('../auth');
const store = require('../store');

const router = express.Router();
router.use(auth.requireAuth);

const uid = (prefix) => `${prefix}-${crypto.randomBytes(4).toString('hex')}`;

router.get('/', (req, res) => {
  const db = store.readDb();
  res.json({ scenes: db.scenes, activeSceneId: db.activeSceneId });
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Scene name is required.' });
  const result = store.update((db) => {
    if (db.scenes.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      return { error: 'A scene with that name already exists.' };
    }
    const scene = { id: uid('scene'), name: name.trim(), sources: [] };
    db.scenes.push(scene);
    if (!db.activeSceneId) db.activeSceneId = scene.id;
    return { scene };
  });
  if (result.error) return res.status(409).json(result);
  res.status(201).json(result);
});

router.delete('/:sceneId', (req, res) => {
  const result = store.update((db) => {
    if (db.scenes.length <= 1) return { error: 'At least one scene must remain.' };
    const idx = db.scenes.findIndex((s) => s.id === req.params.sceneId);
    if (idx === -1) return { error: 'Scene not found.' };
    db.scenes.splice(idx, 1);
    if (db.activeSceneId === req.params.sceneId) db.activeSceneId = db.scenes[0].id;
    return { ok: true };
  });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

router.post('/:sceneId/activate', (req, res) => {
  const result = store.update((db) => {
    const scene = db.scenes.find((s) => s.id === req.params.sceneId);
    if (!scene) return { error: 'Scene not found.' };
    db.activeSceneId = scene.id;
    return { ok: true, activeSceneId: scene.id };
  });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

router.post('/:sceneId/move', (req, res) => {
  const { direction } = req.body || {};
  const result = store.update((db) => {
    const idx = db.scenes.findIndex((s) => s.id === req.params.sceneId);
    if (idx === -1) return { error: 'Scene not found.' };
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= db.scenes.length) return { ok: true, scenes: db.scenes };
    [db.scenes[idx], db.scenes[swapWith]] = [db.scenes[swapWith], db.scenes[idx]];
    return { ok: true, scenes: db.scenes };
  });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

// ----- sources -----

function findScene(db, sceneId, res) {
  const scene = db.scenes.find((s) => s.id === sceneId);
  return scene;
}

router.post('/:sceneId/sources', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.name.trim()) return res.status(400).json({ error: 'Source name is required.' });
  if (!['image', 'media', 'text'].includes(body.type)) return res.status(400).json({ error: 'Invalid source type.' });
  const result = store.update((db) => {
    const scene = findScene(db, req.params.sceneId);
    if (!scene) return { error: 'Scene not found.' };
    if (scene.sources.some((s) => s.name.toLowerCase() === body.name.trim().toLowerCase())) {
      return { error: 'A source with that name already exists in this scene.' };
    }
    const maxZ = scene.sources.reduce((m, s) => Math.max(m, s.zIndex || 0), 0);
    const source = {
      id: uid('src'),
      name: body.name.trim(),
      type: body.type,
      x: Number(body.x) || 0,
      y: Number(body.y) || 0,
      width: Number(body.width) || (body.type === 'text' ? undefined : 320),
      height: Number(body.height) || (body.type === 'text' ? undefined : 180),
      locked: false,
      shown: true,
      zIndex: maxZ + 1,
      file: body.file || undefined,
      loop: !!body.loop,
      fontFamily: body.fontFamily || 'Sans',
      fontSize: Number(body.fontSize) || 32,
      text: body.text || '',
      color: body.color || '#FFFFFF',
      volume: 100,
      muted: false,
      monitor: 'Monitor and Output'
    };
    scene.sources.push(source);
    return { source };
  });
  if (result.error) return res.status(409).json(result);
  res.status(201).json(result);
});

router.put('/:sceneId/sources/:sourceId', (req, res) => {
  const result = store.update((db) => {
    const scene = findScene(db, req.params.sceneId);
    if (!scene) return { error: 'Scene not found.' };
    const source = scene.sources.find((s) => s.id === req.params.sourceId);
    if (!source) return { error: 'Source not found.' };
    if (source.locked && req.body && Object.keys(req.body).some((k) => ['x', 'y', 'width', 'height'].includes(k))) {
      return { error: 'Source is locked.' };
    }
    Object.assign(source, req.body || {});
    return { source };
  });
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

router.delete('/:sceneId/sources/:sourceId', (req, res) => {
  const result = store.update((db) => {
    const scene = findScene(db, req.params.sceneId);
    if (!scene) return { error: 'Scene not found.' };
    scene.sources = scene.sources.filter((s) => s.id !== req.params.sourceId);
    return { ok: true };
  });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

router.post('/:sceneId/sources/:sourceId/move', (req, res) => {
  const { direction } = req.body || {};
  const result = store.update((db) => {
    const scene = findScene(db, req.params.sceneId);
    if (!scene) return { error: 'Scene not found.' };
    const sorted = scene.sources.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const idx = sorted.findIndex((s) => s.id === req.params.sourceId);
    if (idx === -1) return { error: 'Source not found.' };
    const swapWith = direction === 'up' ? idx + 1 : idx - 1; // "up" in a layer stack = higher z
    if (swapWith < 0 || swapWith >= sorted.length) return { ok: true };
    const tmp = sorted[idx].zIndex;
    sorted[idx].zIndex = sorted[swapWith].zIndex;
    sorted[swapWith].zIndex = tmp;
    return { ok: true };
  });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

module.exports = router;
