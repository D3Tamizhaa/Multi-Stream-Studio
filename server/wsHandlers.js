const { WebSocketServer } = require('ws');
const streamManager = require('./streamManager');

function attachWebSockets(server) {
  const ingestWss = new WebSocketServer({ noServer: true });
  const statsWss = new WebSocketServer({ noServer: true });

  ingestWss.on('connection', (ws) => {
    ws.on('message', (data, isBinary) => {
      if (isBinary) streamManager.feed(data);
    });
  });

  const statsClients = new Set();
  statsWss.on('connection', (ws) => {
    statsClients.add(ws);
    ws.send(JSON.stringify(streamManager.getStats()));
    ws.on('close', () => statsClients.delete(ws));
  });

  const broadcastStats = (stats) => {
    const payload = JSON.stringify(stats);
    for (const ws of statsClients) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  };
  streamManager.on('stats', broadcastStats);
  streamManager.on('status', () => broadcastStats(streamManager.getStats()));

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws/ingest') {
      ingestWss.handleUpgrade(req, socket, head, (ws) => ingestWss.emit('connection', ws, req));
    } else if (req.url === '/ws/stats') {
      statsWss.handleUpgrade(req, socket, head, (ws) => statsWss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });
}

module.exports = { attachWebSockets };
