const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const db = require('./db');
const { requireAuth, requireAuthPage } = require('./auth');

db.load();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 }
}));

// --- Protected app shell & uploaded media -----------------------------
app.get(['/', '/index.html'], requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.use('/uploads', requireAuth, express.static(db.UPLOADS_DIR));

// --- Static assets (css/js/login page) ---------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API routes ----------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/scenes', requireAuth, require('./routes/scenes'));
app.use('/api/sources', requireAuth, require('./routes/sources'));
app.use('/api/platforms', requireAuth, require('./routes/platforms'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/stream', requireAuth, require('./routes/stream'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Multi Stream Studio listening on http://localhost:${PORT}`);
  console.log('Default login -> username: admin / password: admin (change it in Settings > Authorization)');
});
