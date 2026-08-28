const express = require('express');
const data = require('./data');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = data.readAll();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  req.session.user = { username: user.username };
  res.json({ ok: true, username: user.username });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  if (req.session && req.session.user) return res.json({ authenticated: true, username: req.session.user.username });
  res.json({ authenticated: false });
});

router.get('/authorization', requireAuth, (req, res) => {
  const db = data.readAll();
  res.json({ username: db.users[0].username });
});

router.put('/authorization', requireAuth, (req, res) => {
  const { username, password } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username required' });
  const db = data.update(d => {
    d.users[0].username = username;
    if (password) d.users[0].password = password;
  });
  req.session.user = { username: db.users[0].username };
  res.json({ ok: true, username: db.users[0].username });
});

module.exports = { router, requireAuth };
