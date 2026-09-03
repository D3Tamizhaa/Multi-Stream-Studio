const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const engine = require('../ffmpeg/engine');

const router = express.Router();

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.tga', '.bmp'];
const MEDIA_EXT = ['.mp4', '.mp3', '.webm'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, db.UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![...IMAGE_EXT, ...MEDIA_EXT].includes(ext)) {
      return cb(new Error('Unsupported file type.'));
    }
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB ceiling for media clips
});

router.get('/', (req, res) => {
  const state = db.get();
  const sceneId = req.query.sceneId || state.activeSceneId;
  res.json({ sources: state.sources.filter((s) => s.sceneId === sceneId).sort((a, b) => a.order - b.order) });
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ file: req.file.filename, originalName: req.file.originalname });
});

router.post('/', (req, res) => {
  const { sceneId, type, name } = req.body || {};
  if (!sceneId || !type || !name) return res.status(400).json({ error: 'sceneId, type and name are required.' });
  const state = db.get();
  const count = state.sources.filter((s) => s.sceneId === sceneId).length;

  const base = {
    id: crypto.randomUUID(),
    sceneId,
    type,
    name,
    x: Number(req.body.x) || 0,
    y: Number(req.body.y) || 0,
    width: Number(req.body.width) || (type === 'text' ? 400 : 320),
    height: Number(req.body.height) || (type === 'text' ? 80 : 180),
    locked: false,
    visible: true,
    order: count
  };

  if (type === 'image') {
    base.file = req.body.file;
  } else if (type === 'media') {
    base.file = req.body.file;
    base.loop = !!req.body.loop;
    base.volume = 1;
    base.muted = false;
  } else if (type === 'text') {
    base.fontFamily = req.body.fontFamily || 'DejaVuSans-Bold';
    base.fontSize = Number(req.body.fontSize) || 32;
    base.text = req.body.text || '';
    base.color = req.body.color || '#ffffff';
  } else {
    return res.status(400).json({ error: 'Unknown source type.' });
  }

  db.set((s) => s.sources.push(base));
  engine.restartIfLive();
  res.status(201).json({ source: base });
});

router.patch('/:id', (req, res) => {
  const state = db.get();
  const src = state.sources.find((s) => s.id === req.params.id);
  if (!src) return res.status(404).json({ error: 'Source not found.' });
  const editable = ['name', 'x', 'y', 'width', 'height', 'locked', 'visible', 'loop', 'volume', 'muted', 'fontFamily', 'fontSize', 'text', 'color', 'file'];
  db.set((s) => {
    const target = s.sources.find((so) => so.id === req.params.id);
    for (const key of editable) {
      if (req.body[key] !== undefined) target[key] = req.body[key];
    }
  });
  engine.restartIfLive();
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const state = db.get();
  const src = state.sources.find((s) => s.id === req.params.id);
  if (src && src.file) {
    const filePath = path.join(db.UPLOADS_DIR, src.file);
    fs.unlink(filePath, () => {});
  }
  db.set((s) => { s.sources = s.sources.filter((so) => so.id !== req.params.id); });
  engine.restartIfLive();
  res.json({ ok: true });
});

router.post('/:id/move', (req, res) => {
  const { direction } = req.body || {};
  db.set((s) => {
    const src = s.sources.find((so) => so.id === req.params.id);
    if (!src) return;
    const siblings = s.sources.filter((so) => so.sceneId === src.sceneId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((so) => so.id === req.params.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const tmp = siblings[idx].order;
    siblings[idx].order = siblings[swapIdx].order;
    siblings[swapIdx].order = tmp;
  });
  engine.restartIfLive();
  res.json({ ok: true });
});

module.exports = router;
