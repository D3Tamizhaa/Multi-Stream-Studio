const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../lib/db');

function id(prefix) { return `${prefix}-${crypto.randomBytes(6).toString('hex')}`; }

// ---- Scenes ----
router.get('/', (req, res) => {
  const data = db.get();
  res.json({ scenes: data.scenes, activeSceneId: data.activeSceneId });
});

router.post('/', (req, res) => {
  const data = db.get();
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Scene name is required' });
  if (data.scenes.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'A scene with that name already exists' });
  }
  const scene = { id: id('scene'), name, sources: [] };
  data.scenes.push(scene);
  db.persist();
  res.json({ scene });
});

router.delete('/:sceneId', (req, res) => {
  const data = db.get();
  const idx = data.scenes.findIndex(s => s.id === req.params.sceneId);
  if (idx === -1) return res.status(404).json({ error: 'Scene not found' });
  if (data.scenes.length === 1) return res.status(400).json({ error: 'At least one scene is required' });
  data.scenes.splice(idx, 1);
  if (data.activeSceneId === req.params.sceneId) data.activeSceneId = data.scenes[0].id;
  db.persist();
  res.json({ ok: true });
});

router.post('/:sceneId/rename', (req, res) => {
  const data = db.get();
  const scene = data.scenes.find(s => s.id === req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Scene name is required' });
  if (data.scenes.some(s => s.id !== scene.id && s.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'A scene with that name already exists' });
  }
  scene.name = name;
  db.persist();
  res.json({ scene });
});

router.post('/:sceneId/move', (req, res) => {
  const data = db.get();
  const idx = data.scenes.findIndex(s => s.id === req.params.sceneId);
  if (idx === -1) return res.status(404).json({ error: 'Scene not found' });
  const dir = req.body.direction === 'up' ? -1 : 1;
  const target = idx + dir;
  if (target < 0 || target >= data.scenes.length) return res.json({ scenes: data.scenes });
  [data.scenes[idx], data.scenes[target]] = [data.scenes[target], data.scenes[idx]];
  db.persist();
  res.json({ scenes: data.scenes });
});

router.post('/:sceneId/activate', (req, res) => {
  const data = db.get();
  const scene = data.scenes.find(s => s.id === req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  data.activeSceneId = scene.id;
  db.persist();
  res.json({ ok: true, activeSceneId: scene.id });
});

// ---- Sources ----
function findScene(req, res) {
  const data = db.get();
  const scene = data.scenes.find(s => s.id === req.params.sceneId);
  if (!scene) { res.status(404).json({ error: 'Scene not found' }); return null; }
  return scene;
}

router.post('/:sceneId/sources', (req, res) => {
  const scene = findScene(req, res);
  if (!scene) return;
  const body = req.body || {};
  if (!['image', 'media', 'text'].includes(body.type)) {
    return res.status(400).json({ error: 'Invalid source type' });
  }
  if (!body.name || !body.name.trim()) return res.status(400).json({ error: 'Source name is required' });

  const source = {
    id: id('src'),
    type: body.type,
    name: body.name.trim(),
    locked: false,
    visible: true,
    x: Number(body.x) || 0,
    y: Number(body.y) || 0,
    width: Number(body.width) || (body.type === 'text' ? 300 : 320),
    height: Number(body.height) || (body.type === 'text' ? 80 : 180)
  };

  if (body.type === 'image') {
    source.file = body.file;
  } else if (body.type === 'media') {
    source.file = body.file;
    source.loop = !!body.loop;
    source.volume = 1;
    // Local-monitor mute only (never affects the outgoing stream -- see
    // lib/ffmpeg.js). Defaults to muted so the workspace preview <video>
    // can autoplay without hitting browser unmuted-autoplay restrictions.
    source.muted = true;
  } else if (body.type === 'text') {
    source.text = body.text || '';
    source.fontFamily = body.fontFamily || 'Arial';
    source.fontSize = Number(body.fontSize) || 32;
    source.color = body.color || '0xFFFFFF';
  }

  scene.sources.push(source);
  db.persist();
  res.json({ source });
});

router.put('/:sceneId/sources/:sourceId', (req, res) => {
  const scene = findScene(req, res);
  if (!scene) return;
  const source = scene.sources.find(s => s.id === req.params.sourceId);
  if (!source) return res.status(404).json({ error: 'Source not found' });
  const allowed = ['name', 'x', 'y', 'width', 'height', 'text', 'fontFamily', 'fontSize', 'color', 'loop', 'volume', 'muted', 'file'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) source[key] = req.body[key];
  }
  db.persist();
  res.json({ source });
});

router.delete('/:sceneId/sources/:sourceId', (req, res) => {
  const scene = findScene(req, res);
  if (!scene) return;
  const idx = scene.sources.findIndex(s => s.id === req.params.sourceId);
  if (idx === -1) return res.status(404).json({ error: 'Source not found' });
  scene.sources.splice(idx, 1);
  db.persist();
  res.json({ ok: true });
});

router.post('/:sceneId/sources/:sourceId/toggle', (req, res) => {
  const scene = findScene(req, res);
  if (!scene) return;
  const source = scene.sources.find(s => s.id === req.params.sourceId);
  if (!source) return res.status(404).json({ error: 'Source not found' });
  const field = req.body.field; // 'locked' | 'visible' | 'muted'
  if (!['locked', 'visible', 'muted'].includes(field)) return res.status(400).json({ error: 'Invalid field' });
  source[field] = !source[field];
  db.persist();
  res.json({ source });
});

router.post('/:sceneId/sources/:sourceId/move', (req, res) => {
  const scene = findScene(req, res);
  if (!scene) return;
  const idx = scene.sources.findIndex(s => s.id === req.params.sourceId);
  if (idx === -1) return res.status(404).json({ error: 'Source not found' });
  const dir = req.body.direction === 'up' ? 1 : -1; // "up" in a sources list = higher in stack/rendered later
  const target = idx + dir;
  if (target < 0 || target >= scene.sources.length) return res.json({ sources: scene.sources });
  [scene.sources[idx], scene.sources[target]] = [scene.sources[target], scene.sources[idx]];
  db.persist();
  res.json({ sources: scene.sources });
});

module.exports = router;
