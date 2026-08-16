const http = require('node:http')
const process = require('node:process')
const os = require('node:os')

let previousCpu = process.cpuUsage()
let previousTime = process.hrtime.bigint()

let currentCpu = 0

function updateCpuUsage() {
  const currentCpuUsage = process.cpuUsage()
  const currentTime = process.hrtime.bigint()

  const cpuDelta =
    (currentCpuUsage.user - previousCpu.user) +
    (currentCpuUsage.system - previousCpu.system)

  const timeDelta =
    Number(currentTime - previousTime) / 1000

  if (timeDelta > 0) {
    currentCpu =
      (cpuDelta / timeDelta) * 100

    currentCpu = Math.max(
      0,
      Math.min(100, currentCpu),
    )
  }

  previousCpu = currentCpuUsage
  previousTime = currentTime
}

// Update every second.
updateCpuUsage()
setInterval(updateCpuUsage, 1000)

function getSystemStats() {
  const memory = process.memoryUsage()

  return {
    // CPU used by Multi-Stream Studio's
    // Electron/Node process.
    cpu: Number(currentCpu.toFixed(1)),

    // RAM used by Multi-Stream Studio's
    // Electron/Node process, in MB.
    ram: Number(
      (memory.rss / 1024 / 1024).toFixed(1),
    ),
  }
}

const statsServer = http.createServer((req, res) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*',
  )

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, OPTIONS',
  )

  res.setHeader(
    'Cache-Control',
    'no-store',
  )

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (
    req.method === 'GET' &&
    req.url === '/api/system-stats'
  ) {
    const stats = getSystemStats()

    console.log('Multi-Stream Studio stats:', stats)

    res.writeHead(200, {
      'Content-Type': 'application/json',
    })

    res.end(JSON.stringify(stats))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

statsServer.on('error', (error) => {
  console.error(
    'System stats server error:',
    error,
  )
})

statsServer.listen(
  3001,
  '127.0.0.1',
  () => {
    console.log(
      'System stats API running at:',
      'http://127.0.0.1:3001/api/system-stats',
    )
  },
)
