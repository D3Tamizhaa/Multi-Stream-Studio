const jwt = require('jsonwebtoken');

// Generated at boot; sessions reset on server restart (fine for a self-hosted single-user tool).
const SECRET = require('crypto').randomBytes(32).toString('hex');

function issueToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, SECRET, { expiresIn: '12h' });
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.mss_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}

module.exports = { issueToken, requireAuth, SECRET };
