const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require('socket.io');

const { requireAuth } = require('./middleware/auth');
const streamManager = require('./ffmpeg/streamManager');

const authRoutes = require('./routes/auth');
const scenesRoutes = require('./routes/scenes');
const settingsRoutes = require('./routes/settings');
const streamRoutes = require('./routes/stream');
const uploadRoutes = require('./routes/upload');

const PORT = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
streamManager.attachIo(io);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- API ----
app.use('/api/auth', authRoutes);
app.use('/api/scenes', requireAuth, scenesRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/stream', requireAuth, streamRoutes);
app.use('/api/upload', requireAuth, uploadRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  socket.emit('stream:status', streamManager.getStatus());
});

server.listen(PORT, () => {
  console.log(`\n  Multi Stream Studio running at http://localhost:${PORT}\n  Default login: admin / admin\n`);
});
