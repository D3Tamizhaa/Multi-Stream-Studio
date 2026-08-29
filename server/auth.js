'use strict';

const bcrypt = require('bcryptjs');
const store = require('./store');

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

function login(username, password) {
  const db = store.readDb();
  if (username !== db.auth.username) return false;
  return bcrypt.compareSync(password, db.auth.passwordHash);
}

function updateCredentials(newUsername, newPassword) {
  store.update((db) => {
    if (newUsername) db.auth.username = newUsername;
    if (newPassword) db.auth.passwordHash = bcrypt.hashSync(newPassword, 10);
  });
}

module.exports = { requireAuth, login, updateCredentials };
