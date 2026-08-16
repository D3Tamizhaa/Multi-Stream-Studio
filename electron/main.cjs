const http = require('node:http')
const os = require('node:os')

let previousCpu = null
let currentCpu = 0

function getCpuSnapshot() {
  const cpus = os.cpus()

  let idle = 0
  let total = 0

  for (const cpu of cpus) {
    const { user, nice, sys, idle: cpuIdle, irq } = cpu.times

    idle += cpuIdle
    total += user + nice + sys + cpuIdle + irq
  }

  return { idle, total }
}

function updateCpuUsage() {
  const current = getCpuSnapshot()

  if (previousCpu) {
    const idleDelta = current.idle - previousCpu.idle
    const totalDelta = current.total - previousCpu.total

    if (totalDelta > 0) {
      currentCpu = Math.max(
        0,
        Math.min(
          100,
          100 - (idleDelta / totalDelta) * 100,
        ),
      )
    }
  }

  previousCpu = current
}

// Take CPU samples continuously.
updateCpuUsage()
setInterval(updateCpuUsage, 1000)

function getSystemStats() {
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()

  const ramUsage =
    ((totalMemory - freeMemory) / totalMemory) * 100

  return {
    cpu: Number(currentCpu.toFixed(1)),
    ram: Number(ramUsage.toFixed(1)),
  }
}

const statsServer = http.createServer((req, res) => {
  // CORS
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

    console.log('System stats:', stats)

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
