const express = require('express');
const router = express.Router();
const store = require('../store');
const streamManager = require('../ffmpeg/streamManager');

router.get('/', (req, res) => {
  res.json(store.getScenes());
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Scene name is required' });
  const data = store.getScenes();
  if (data.scenes.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'A scene with that name already exists' });
  }
  const scene = { id: `scene-${store.id()}`, name: name.trim(), sources: [] };
  data.scenes.push(scene);
  store.saveScenes(data);
  res.status(201).json(scene);
});

router.delete('/:sceneId', (req, res) => {
  const data = store.getScenes();
  if (data.scenes.length <= 1) return res.status(400).json({ error: 'At least one scene must remain' });
  const idx = data.scenes.findIndex((s) => s.id === req.params.sceneId);
  if (idx === -1) return res.status(404).json({ error: 'Scene not found' });
  data.scenes.splice(idx, 1);
  if (data.activeSceneId === req.params.sceneId) data.activeSceneId = data.scenes[0].id;
  store.saveScenes(data);
  res.json({ ok: true });
});

router.put('/:sceneId/move', (req, res) => {
  const { direction } = req.body || {}; // 'up' | 'down'
  const data = store.getScenes();
  const idx = data.scenes.findIndex((s) => s.id === req.params.sceneId);
  if (idx === -1) return res.status(404).json({ error: 'Scene not found' });
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= data.scenes.length) return res.json(data);
  [data.scenes[idx], data.scenes[swapWith]] = [data.scenes[swapWith], data.scenes[idx]];
  store.saveScenes(data);
  res.json(data);
});

router.put('/:sceneId/rename', (req, res) => {
  const { name } = req.body || {};
  const data = store.getScenes();
  const scene = data.scenes.find((s) => s.id === req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  if (data.scenes.some((s) => s.id !== scene.id && s.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'A scene with that name already exists' });
  }
  scene.name = name.trim();
  store.saveScenes(data);
  res.json(scene);
});

router.put('/active/:sceneId', (req, res) => {
  const data = store.getScenes();
  if (!data.scenes.some((s) => s.id === req.params.sceneId)) return res.status(404).json({ error: 'Scene not found' });
  data.activeSceneId = req.params.sceneId;
  store.saveScenes(data);
  streamManager.restartIfLive();
  res.json(data);
});

// ---- Sources within a scene ----
router.post('/:sceneId/sources', (req, res) => {
  const data = store.getScenes();
  const scene = data.scenes.find((s) => s.id === req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const src = req.body || {};
  if (!src.name || !src.type) return res.status(400).json({ error: 'Source name and type are required' });

  const source = {
    id: `src-${store.id()}`,
    type: src.type, // image | media | text
    name: src.name,
    x: Number(src.x) || 0,
    y: Number(src.y) || 0,
    width: Number(src.width) || (src.type === 'text' ? 200 : 320),
    height: Number(src.height) || (src.type === 'text' ? 60 : 180),
    locked: false,
    shown: true,
    // image/media
    file: src.file || undefined,
    loop: !!src.loop,
    volume: src.volume !== undefined ? Number(src.volume) : 1,
    muted: false,
    monitor: src.monitor || 'Monitor and Output',
    // text
    fontFamily: src.fontFamily || 'Arial',
    fontSize: Number(src.fontSize) || 32,
    text: src.text || '',
    color: src.color || '#FFFFFF',
  };
  scene.sources.push(source);
  store.saveScenes(data);
  streamManager.restartIfLive();
  res.status(201).json(source);
});

router.put('/:sceneId/sources/:sourceId', (req, res) => {
  const data = store.getScenes();
  const scene = data.scenes.find((s) => s.id === req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  const source = scene.sources.find((s) => s.id === req.params.sourceId);
  if (!source) return res.status(404).json({ error: 'Source not found' });
  Object.assign(source, req.body || {});
  store.saveScenes(data);
  if (data.activeSceneId === scene.id) streamManager.restartIfLive();
  res.json(source);
});

router.delete('/:sceneId/sources/:sourceId', (req, res) => {
  const data = store.getScenes();
  const scene = data.scenes.find((s) => s.id === req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  scene.sources = scene.sources.filter((s) => s.id !== req.params.sourceId);
  store.saveScenes(data);
  if (data.activeSceneId === scene.id) streamManager.restartIfLive();
  res.json({ ok: true });
});

router.put('/:sceneId/sources/:sourceId/move', (req, res) => {
  const { direction } = req.body || {};
  const data = store.getScenes();
  const scene = data.scenes.find((s) => s.id === req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  const idx = scene.sources.findIndex((s) => s.id === req.params.sourceId);
  if (idx === -1) return res.status(404).json({ error: 'Source not found' });
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= scene.sources.length) return res.json(scene);
  [scene.sources[idx], scene.sources[swapWith]] = [scene.sources[swapWith], scene.sources[idx]];
  store.saveScenes(data);
  res.json(scene);
});

module.exports = router;
