'use strict';

const express = require('express');
const auth = require('../auth');
const store = require('../store');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (!auth.login(username, password)) return res.status(401).json({ error: 'Invalid username or password.' });
  req.session.user = { username };
  res.json({ ok: true, username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ username: req.session.user.username });
});

router.put('/credentials', auth.requireAuth, (req, res) => {
  const { username, password } = req.body || {};
  if (!username && !password) return res.status(400).json({ error: 'Nothing to update.' });
  auth.updateCredentials(username, password);
  if (username) req.session.user.username = username;
  res.json({ ok: true });
});

module.exports = router;
