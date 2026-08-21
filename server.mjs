import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const DIST = path.join(__dirname, 'dist')

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })

  res.end(JSON.stringify(data))
}

function serveStatic(req, res) {
  let requestPath = decodeURIComponent(
    req.url.split('?')[0]
  )

  if (requestPath === '/') {
    requestPath = '/index.html'
  }

  const filePath = path.join(DIST, requestPath)

  // Prevent path traversal.
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      // SPA fallback
      fs.readFile(
        path.join(DIST, 'index.html'),
        (fallbackError, html) => {
          if (fallbackError) {
            res.writeHead(404)
            res.end('Not found')
            return
          }

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          })

          res.end(html)
        }
      )

      return
    }

    const ext = path.extname(filePath)

    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    }

    res.writeHead(200, {
      'Content-Type':
        contentTypes[ext] || 'application/octet-stream',
    })

    res.end(data)
  })
}

/*
 * IMPORTANT:
 * The server must be declared BEFORE server.listen().
 */
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })

    res.end()
    return
  }

  if (
    req.method === 'GET' &&
    req.url.startsWith('/api/system-stats')
  ) {
    sendJson(res, 200, getSystemStats())
    return
  }

  serveStatic(req, res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Multi Stream Studio server running on port ${PORT}`
  )
})
