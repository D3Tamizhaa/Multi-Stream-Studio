const bcrypt = require('bcryptjs');
const db = require('./db');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

function requireAuthPage(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.redirect('/login.html');
}

function checkLogin(username, password) {
  const { user } = db.get();
  if (username !== user.username) return false;
  return bcrypt.compareSync(password, user.passwordHash);
}

module.exports = { requireAuth, requireAuthPage, checkLogin };
