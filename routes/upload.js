const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.tga', '.bmp'];
const MEDIA_EXT = ['.mp4', '.mp3', '.webm'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB ceiling for media clips
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![...IMAGE_EXT, ...MEDIA_EXT].includes(ext)) {
      return cb(new Error(`Unsupported file type: ${ext}`));
    }
    cb(null, true);
  }
});

// Frontend shows upload progress via XHR's native upload.onprogress event
// against this endpoint (see public/js/sources.js) -- no server-side
// progress plumbing needed for a single PUT/POST of the whole file.
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const kind = IMAGE_EXT.includes(ext) ? 'image' : 'media';
  res.json({ file: req.file.filename, kind, url: `/uploads/${req.file.filename}` });
});

router.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

module.exports = router;
