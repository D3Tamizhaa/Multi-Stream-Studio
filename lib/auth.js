'use strict';
const crypto = require('crypto');

// In-memory session store: token -> { username, created }
const sessions = new Map();
const COOKIE_NAME = 'mss_sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { username, created: Date.now() });
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.created > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function getSessionFromReq(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const s = getSession(token);
  return s ? { token, ...s } : null;
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

module.exports = {
  COOKIE_NAME,
  createSession,
  destroySession,
  getSessionFromReq,
  setSessionCookie,
  clearSessionCookie
};
