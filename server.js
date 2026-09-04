// server.js
// Entry point. Ultra-lightweight: Express + a handful of small route modules,
// a JSON-file "database" (lib/db.js), and an FFmpeg process manager (lib/ffmpeg.js).
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const { requireAuth } = require('./lib/auth');
const { StreamEngine } = require('./lib/ffmpeg');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 8787;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const engine = new StreamEngine();
app.set('engine', engine);
app.set('uploadsDir', UPLOADS_DIR);

// ---- Public routes ----
app.use('/api/auth', require('./routes/auth'));

// ---- Authenticated routes ----
app.use('/api/scenes', requireAuth, require('./routes/scenes'));
app.use('/api/upload', requireAuth, require('./routes/upload'));
app.use('/api/platforms', requireAuth, require('./routes/platforms'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/stream', requireAuth, require('./routes/stream'));

// SPA fallback: login page at root, studio app behind auth check done client-side
// (studio.html itself calls /api/auth/me and redirects to / if not authenticated).
app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);

// ---- WebSocket: live stream status / uptime push ----
const wss = new WebSocket.Server({ server, path: '/ws/status' });
function broadcast(snapshot) {
  const msg = JSON.stringify({ type: 'status', data: snapshot });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}
engine.onUpdate(broadcast);

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', data: engine.snapshot() }));
});

// Push an uptime tick every second while live so the status bar stays accurate
// even if no other engine event has fired.
setInterval(() => {
  if (engine.isRunning()) broadcast(engine.snapshot());
}, 1000);

server.listen(PORT, () => {
  console.log(`Multi Stream Studio running at http://localhost:${PORT}`);
  console.log(`Default login -> username: admin / password: admin (change this in Settings > Authorization)`);
});
