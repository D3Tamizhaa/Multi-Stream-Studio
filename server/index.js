const http = require('http');
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { router: authRouter, requireAuth } = require('./auth');
const apiRouter = require('./api');
const { attachWebSockets } = require('./wsHandlers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(cookieSession({
  name: 'mss.session',
  keys: [process.env.SESSION_SECRET || 'dev-secret-change-me'],
  maxAge: 24 * 60 * 60 * 1000
}));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

// Uploaded image/media sources
const multerLike = require('./upload');
app.post('/api/upload', requireAuth, multerLike.single('file'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = http.createServer(app);
attachWebSockets(server);

server.listen(PORT, () => {
  console.log(`Multi Stream Studio running at http://localhost:${PORT}`);
});
