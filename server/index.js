'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const auth = require('./auth');
const store = require('./store');
const { FfmpegEngine } = require('./ffmpegEngine');

const authRoutes = require('./routes/auth');
const sceneRoutes = require('./routes/scenes');
const platformRoutes = require('./routes/platforms');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/uploads');
const createStreamRouter = require('./routes/stream');
const createPreviewRouter = require('./routes/preview');

const PORT = process.env.PORT || 8080;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const app = express();
const engine = new FfmpegEngine();

app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 }
}));

app.use('/api/auth', authRoutes);
app.use('/api/scenes', sceneRoutes);
app.use('/api/platforms', platformRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/stream', createStreamRouter(engine));
app.use('/api/preview', createPreviewRouter(engine));

// authenticated static access to uploaded media, for previews in the workspace
app.use('/media', auth.requireAuth, express.static(path.join(__dirname, '..', 'uploads')));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/stats' });

function broadcastStats() {
  const payload = JSON.stringify({ type: 'stats', live: engine.isLive(), stats: engine.getStats() });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(payload);
  });
}

engine.on('stats', broadcastStats);
engine.on('started', broadcastStats);
engine.on('stopped', broadcastStats);
setInterval(broadcastStats, 2000);

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'stats', live: engine.isLive(), stats: engine.getStats() }));
});

store.readDb(); // ensure data/db.json exists with defaults on first boot

server.listen(PORT, () => {
  console.log(`Multi Stream Studio listening on http://localhost:${PORT}`);
});
