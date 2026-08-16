const http = require('node:http')
const os = require('node:os')

let previousCpu = null

function getCpuSnapshot() {
  const cpus = os.cpus()

  let idle = 0
  let total = 0

  for (const cpu of cpus) {
    const times = cpu.times

    idle += times.idle
    total +=
      times.user +
      times.nice +
      times.sys +
      times.idle +
      times.irq
  }

  return { idle, total }
}

function getCpuUsage() {
  const current = getCpuSnapshot()

  if (!previousCpu) {
    previousCpu = current
    return 0
  }

  const idleDelta = current.idle - previousCpu.idle
  const totalDelta = current.total - previousCpu.total

  previousCpu = current

  if (totalDelta <= 0) {
    return 0
  }

  return Math.max(
    0,
    Math.min(
      100,
      100 - (idleDelta / totalDelta) * 100,
    ),
  )
}

function getSystemStats() {
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const usedMemory = totalMemory - freeMemory

  return {
    cpu: Number(getCpuUsage().toFixed(1)),
    ram: Number(
      ((usedMemory / totalMemory) * 100).toFixed(1),
    ),
  }
}

const statsServer = http.createServer((req, res) => {
  if (req.method === 'GET' &&
      req.url === '/api/system-stats') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    })

    res.end(JSON.stringify(getSystemStats()))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

statsServer.listen(3001, '127.0.0.1', () => {
  console.log(
    'System stats API running at http://127.0.0.1:3001',
  )
})
