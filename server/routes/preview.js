'use strict';

const express = require('express');
const path = require('path');
const auth = require('../auth');
const store = require('../store');

module.exports = function createPreviewRouter(engine) {
  const router = express.Router();
  router.use(auth.requireAuth);

  router.get('/:sceneId.jpg', async (req, res) => {
    const db = store.readDb();
    const scene = db.scenes.find((s) => s.id === req.params.sceneId);
    if (!scene) return res.status(404).end();
    try {
      const jpg = await engine.renderPreviewFrame({
        scene,
        settings: db.settings,
        uploadsDir: path.join(__dirname, '..', '..', 'uploads')
      });
      res.set('Cache-Control', 'no-store');
      res.type('image/jpeg').send(jpg);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
