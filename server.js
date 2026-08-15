import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

const PORT = process.env.PORT || 3000;

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  // API
  if (req.url === "/api/status") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    });

    res.end(JSON.stringify({
      status: "offline",
      uptime: "00:00:00",
      bitrate: 0,
      fps: 0,
      cpu: 0,
      ram: 0
    }));

    return;
  }

  // Static files
  let requestPath = req.url.split("?")[0];

  if (requestPath === "/") {
    requestPath = "/index.html";
  }

  const filePath = path.join(publicDir, requestPath);

  // Prevent path traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, {
        "Content-Type": "text/plain"
      });

      res.end("Not Found");
      return;
    }

    const extension = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });

    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Multi Stream Studio running at http://localhost:${PORT}`);
});
