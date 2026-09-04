const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { requireAuth, createSessionCookie, clearSessionCookie } = require('../lib/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const data = db.get();
  if (username === data.user.username && db.verifyPassword(password, data.user.passwordHash)) {
    createSessionCookie(res, username);
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const { requireAuth: _ignore } = {};
  const token = req.cookies ? req.cookies['mss_session'] : null;
  const { verify } = require('../lib/auth');
  const session = verify(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ username: session.username });
});

router.post('/update', requireAuth, (req, res) => {
  const { username, currentPassword, newPassword } = req.body || {};
  const data = db.get();

  if (!db.verifyPassword(currentPassword, data.user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (username && username.trim()) data.user.username = username.trim();
  if (newPassword && newPassword.trim()) data.user.passwordHash = db.hashPassword(newPassword.trim());
  db.persist();
  createSessionCookie(res, data.user.username);
  res.json({ ok: true, username: data.user.username });
});

module.exports = router;
