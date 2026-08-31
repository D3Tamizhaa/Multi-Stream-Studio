const express = require('express');
const router = express.Router();
const store = require('../store');
const hashUtil = require('../util/simpleHash');
const { issueToken, requireAuth } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const { users } = store.getUsers();
  const user = users.find((u) => u.username === username);
  if (!user || !hashUtil.verify(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = issueToken(user);
  res.cookie('mss_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 });
  res.json({ id: user.id, username: user.username });
});

router.post('/logout', (req, res) => {
  res.clearCookie('mss_token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.sub, username: req.user.username });
});

// Authorization Settings: update username/password
router.put('/credentials', requireAuth, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const data = store.getUsers();
  const user = data.users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.username = username;
  user.passwordHash = hashUtil.hash(password);
  store.saveUsers(data);
  const token = issueToken(user);
  res.cookie('mss_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 });
  res.json({ id: user.id, username: user.username });
});

module.exports = router;
