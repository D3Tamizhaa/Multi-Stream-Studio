'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const auth = require('../auth');

const router = express.Router();
router.use(auth.requireAuth);

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.tga', '.bmp'];
const MEDIA_EXT = ['.mp4', '.mp3', '.webm'];
const FONT_EXT = ['.ttf', '.otf'];

function storageFor(sub) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_ROOT, sub)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  });
}

function fileFilterFor(allowedExts) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) return cb(new Error(`Unsupported file type "${ext}".`));
    cb(null, true);
  };
}

const uploadImage = multer({ storage: storageFor('images'), fileFilter: fileFilterFor(IMAGE_EXT), limits: { fileSize: 50 * 1024 * 1024 } });
const uploadMedia = multer({ storage: storageFor('media'), fileFilter: fileFilterFor(MEDIA_EXT), limits: { fileSize: 2 * 1024 * 1024 * 1024 } });
const uploadFont = multer({ storage: storageFor('fonts'), fileFilter: fileFilterFor(FONT_EXT), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/image', uploadImage.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ file: req.file.filename, originalName: req.file.originalname });
});

router.post('/media', uploadMedia.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ file: req.file.filename, originalName: req.file.originalname });
});

router.post('/font', uploadFont.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ file: req.file.filename, originalName: req.file.originalname });
});

router.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Upload failed.' });
});

module.exports = router;
