'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const db = require('./lib/db');
const auth = require('./lib/auth');
const { parseContentType, parseMultipart } = require('./lib/multipart');
const encoders = require('./lib/encoders');
const ffmpeg = require('./lib/ffmpeg');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.bmp': 'image/bmp', '.tga': 'image/x-tga', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers || {}));
  res.end(body);
}
function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 500 * 1024 * 1024) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { return {}; }
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath);
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
}

function serveUpload(req, res, pathname) {
  const rel = pathname.replace('/uploads/', '');
  const filePath = path.normalize(path.join(UPLOADS_DIR, rel));
  if (!filePath.startsWith(UPLOADS_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath);
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
}

function requireAuth(req, res) {
  const session = auth.getSessionFromReq(req);
  if (!session) { sendJson(res, 401, { error: 'Not authenticated' }); return null; }
  return session;
}

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const pathname = u.pathname;
  const method = req.method;

  try {
    // ---------- static assets ----------
    if (method === 'GET' && pathname.startsWith('/uploads/')) return serveUpload(req, res, pathname);
    if (method === 'GET' && !pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

    // ---------- auth ----------
    if (method === 'POST' && pathname === '/api/login') {
      const body = await readJson(req);
      const database = db.read();
      if (body.username === database.user.username && db.verifyPassword(body.password, database.user.salt, database.user.hash)) {
        const token = auth.createSession(body.username);
        auth.setSessionCookie(res, token);
        return sendJson(res, 200, { ok: true, username: body.username });
      }
      return sendJson(res, 401, { error: 'Invalid username or password' });
    }
    if (method === 'POST' && pathname === '/api/logout') {
      const session = auth.getSessionFromReq(req);
      if (session) auth.destroySession(session.token);
      auth.clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'GET' && pathname === '/api/session') {
      const session = auth.getSessionFromReq(req);
      if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
      return sendJson(res, 200, { username: session.username });
    }

    // everything past this point requires auth
    if (pathname.startsWith('/api/') && pathname !== '/api/login') {
      const session = requireAuth(req, res);
      if (!session) return;
    }

    // ---------- encoders capability map ----------
    if (method === 'GET' && pathname === '/api/encoders') {
      return sendJson(res, 200, encoders.listForUI());
    }

    // ---------- scenes ----------
    if (method === 'GET' && pathname === '/api/scenes') {
      const database = db.read();
      return sendJson(res, 200, { scenes: database.scenes, activeSceneId: database.activeSceneId });
    }
    if (method === 'POST' && pathname === '/api/scenes') {
      const body = await readJson(req);
      const database = db.read();
      const name = String(body.name || '').trim();
      if (!name) return sendJson(res, 400, { error: 'Scene name required' });
      if (database.scenes.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        return sendJson(res, 400, { error: 'A scene with that name already exists' });
      }
      const scene = { id: newId('scene'), name, sources: [] };
      database.scenes.push(scene);
      if (!database.activeSceneId) database.activeSceneId = scene.id;
      db.write(database);
      return sendJson(res, 200, { scene });
    }
    let m;
    if (method === 'PUT' && (m = pathname.match(/^\/api\/scenes\/([^/]+)$/))) {
      const body = await readJson(req);
      const database = db.read();
      const scene = database.scenes.find(s => s.id === m[1]);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });
      if (body.name && body.name !== scene.name) {
        if (database.scenes.some(s => s.id !== scene.id && s.name.toLowerCase() === body.name.toLowerCase())) {
          return sendJson(res, 400, { error: 'A scene with that name already exists' });
        }
        scene.name = body.name;
      }
      if (typeof body.order === 'number') scene.order = body.order;
      db.write(database);
      return sendJson(res, 200, { scene });
    }
    if (method === 'DELETE' && (m = pathname.match(/^\/api\/scenes\/([^/]+)$/))) {
      const database = db.read();
      database.scenes = database.scenes.filter(s => s.id !== m[1]);
      if (database.activeSceneId === m[1]) database.activeSceneId = database.scenes[0] ? database.scenes[0].id : null;
      db.write(database);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'POST' && (m = pathname.match(/^\/api\/scenes\/([^/]+)\/activate$/))) {
      const database = db.read();
      if (!database.scenes.some(s => s.id === m[1])) return sendJson(res, 404, { error: 'Scene not found' });
      database.activeSceneId = m[1];
      db.write(database);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'POST' && (m = pathname.match(/^\/api\/scenes\/([^/]+)\/move$/))) {
      const body = await readJson(req);
      const database = db.read();
      const idx = database.scenes.findIndex(s => s.id === m[1]);
      if (idx === -1) return sendJson(res, 404, { error: 'Scene not found' });
      const swapWith = idx + (body.direction === 'up' ? -1 : 1);
      if (swapWith < 0 || swapWith >= database.scenes.length) return sendJson(res, 200, { scenes: database.scenes });
      [database.scenes[idx], database.scenes[swapWith]] = [database.scenes[swapWith], database.scenes[idx]];
      db.write(database);
      return sendJson(res, 200, { scenes: database.scenes });
    }

    // ---------- sources ----------
    if (method === 'POST' && (m = pathname.match(/^\/api\/scenes\/([^/]+)\/sources$/))) {
      const body = await readJson(req);
      const database = db.read();
      const scene = database.scenes.find(s => s.id === m[1]);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });
      const source = Object.assign({
        id: newId('src'), visible: true, locked: false, order: scene.sources.length,
        x: 0, y: 0, width: 320, height: 240, volume: 1, muted: false, loop: false,
        hasVideo: true, hasAudio: true
      }, body);
      scene.sources.push(source);
      db.write(database);
      return sendJson(res, 200, { source });
    }
    if (method === 'PUT' && (m = pathname.match(/^\/api\/scenes\/([^/]+)\/sources\/([^/]+)$/))) {
      const body = await readJson(req);
      const database = db.read();
      const scene = database.scenes.find(s => s.id === m[1]);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });
      const source = scene.sources.find(s => s.id === m[2]);
      if (!source) return sendJson(res, 404, { error: 'Source not found' });
      Object.assign(source, body);
      db.write(database);
      return sendJson(res, 200, { source });
    }
    if (method === 'DELETE' && (m = pathname.match(/^\/api\/scenes\/([^/]+)\/sources\/([^/]+)$/))) {
      const database = db.read();
      const scene = database.scenes.find(s => s.id === m[1]);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });
      scene.sources = scene.sources.filter(s => s.id !== m[2]);
      db.write(database);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'POST' && (m = pathname.match(/^\/api\/scenes\/([^/]+)\/sources\/([^/]+)\/move$/))) {
      const body = await readJson(req);
      const database = db.read();
      const scene = database.scenes.find(s => s.id === m[1]);
      if (!scene) return sendJson(res, 404, { error: 'Scene not found' });
      scene.sources.sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = scene.sources.findIndex(s => s.id === m[2]);
      const swapWith = idx + (body.direction === 'up' ? -1 : 1);
      if (idx === -1 || swapWith < 0 || swapWith >= scene.sources.length) return sendJson(res, 200, { sources: scene.sources });
      [scene.sources[idx].order, scene.sources[swapWith].order] = [scene.sources[swapWith].order, scene.sources[idx].order];
      db.write(database);
      return sendJson(res, 200, { sources: scene.sources });
    }

    // ---------- file upload ----------
    if (method === 'POST' && pathname === '/api/upload') {
      const ct = req.headers['content-type'] || '';
      const { boundary } = parseContentType(ct);
      if (!boundary) return sendJson(res, 400, { error: 'Invalid multipart request' });
      const buf = await readBody(req);
      const { files } = parseMultipart(buf, boundary);
      const file = files.file;
      if (!file) return sendJson(res, 400, { error: 'No file provided' });
      const ext = path.extname(file.filename) || '';
      const safeName = `${newId('upload')}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, safeName), file.data);
      return sendJson(res, 200, { file: safeName, url: `/uploads/${safeName}` });
    }

    // ---------- platforms ----------
    if (method === 'GET' && pathname === '/api/platforms') {
      const database = db.read();
      return sendJson(res, 200, { platforms: database.platforms, defaults: ffmpeg.SERVICE_DEFAULT_SERVER });
    }
    if (method === 'POST' && pathname === '/api/platforms') {
      const body = await readJson(req);
      const database = db.read();
      const platform = {
        id: newId('plat'), enabled: true,
        service: body.service, server: body.server || ffmpeg.SERVICE_DEFAULT_SERVER[body.service] || '',
        streamKey: body.streamKey || '', name: body.name || body.service
      };
      database.platforms.push(platform);
      db.write(database);
      return sendJson(res, 200, { platform });
    }
    if (method === 'PUT' && (m = pathname.match(/^\/api\/platforms\/([^/]+)$/))) {
      const body = await readJson(req);
      const database = db.read();
      const platform = database.platforms.find(p => p.id === m[1]);
      if (!platform) return sendJson(res, 404, { error: 'Platform not found' });
      Object.assign(platform, body);
      db.write(database);
      return sendJson(res, 200, { platform });
    }
    if (method === 'DELETE' && (m = pathname.match(/^\/api\/platforms\/([^/]+)$/))) {
      const database = db.read();
      database.platforms = database.platforms.filter(p => p.id !== m[1]);
      db.write(database);
      return sendJson(res, 200, { ok: true });
    }

    // ---------- settings: authorization ----------
    if (method === 'PUT' && pathname === '/api/settings/authorization') {
      const body = await readJson(req);
      const database = db.read();
      if (!db.verifyPassword(body.currentPassword, database.user.salt, database.user.hash)) {
        return sendJson(res, 401, { error: 'Current password is incorrect' });
      }
      if (body.username) database.user.username = body.username;
      if (body.newPassword) {
        const { salt, hash } = db.hashPassword(body.newPassword);
        database.user.salt = salt; database.user.hash = hash;
      }
      db.write(database);
      return sendJson(res, 200, { ok: true, username: database.user.username });
    }

    // ---------- settings: output / audio / video / advanced ----------
    if (method === 'GET' && pathname === '/api/settings') {
      const database = db.read();
      return sendJson(res, 200, { settings: database.settings });
    }
    if (method === 'PUT' && (m = pathname.match(/^\/api\/settings\/(output|audio|video|advanced)$/))) {
      const body = await readJson(req);
      const database = db.read();
      database.settings[m[1]] = Object.assign({}, database.settings[m[1]], body);
      db.write(database);
      return sendJson(res, 200, { settings: database.settings });
    }

    // ---------- streaming control ----------
    if (method === 'POST' && pathname === '/api/stream/start') {
      const database = db.read();
      try {
        ffmpeg.start(database);
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }
    if (method === 'POST' && pathname === '/api/stream/stop') {
      ffmpeg.stop();
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'GET' && pathname === '/api/stream/status') {
      return sendJson(res, 200, ffmpeg.getStatus());
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Multi Stream Studio running at http://localhost:${PORT}`);
  console.log('Default login -> username: admin / password: admin (change it in Settings > Authorization)');
});
