const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { checkLogin, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (!checkLogin(username, password)) return res.status(401).json({ error: 'Invalid username or password.' });
  req.session.authenticated = true;
  req.session.username = username;
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, (req, res) => {
  const { user } = db.get();
  res.json({ username: user.username });
});

// Authorization settings (change username / password)
router.post('/authorization', requireAuth, (req, res) => {
  const { username, currentPassword, newPassword } = req.body || {};
  const state = db.get();
  if (!bcrypt.compareSync(currentPassword || '', state.user.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  db.set((s) => {
    if (username) s.user.username = username;
    if (newPassword) s.user.passwordHash = bcrypt.hashSync(newPassword, 10);
  });
  req.session.username = username || state.user.username;
  res.json({ ok: true });
});

module.exports = router;
