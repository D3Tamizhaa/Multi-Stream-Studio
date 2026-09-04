// lib/auth.js
// Minimal stateless session auth using a signed, httpOnly cookie.
// Avoids pulling in express-session / a session store to keep the repo lightweight.
const crypto = require('crypto');
const db = require('./db');

const COOKIE_NAME = 'mss_session';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function sign(payload) {
  const { sessionSecret } = db.get();
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  const { sessionSecret } = db.get();
  const expected = crypto.createHmac('sha256', sessionSecret).update(b64).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function createSessionCookie(res, username) {
  const token = sign({ username, exp: Date.now() + MAX_AGE_MS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  const session = verify(token);
  if (!session) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/');
  }
  req.session = session;
  next();
}

module.exports = { requireAuth, createSessionCookie, clearSessionCookie, COOKIE_NAME, verify };
