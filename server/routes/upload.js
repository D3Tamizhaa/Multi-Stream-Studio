const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.tga', '.bmp'],
  media: ['.mp4', '.mp3', '.webm'],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const kind = req.query.kind === 'media' ? 'media' : 'image';
    if (!ALLOWED[kind].includes(ext)) {
      return cb(new Error(`Unsupported file type "${ext}" for ${kind} sources`));
    }
    cb(null, true);
  },
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.status(201).json({ file: req.file.filename, originalName: req.file.originalname });
});

module.exports = router;
