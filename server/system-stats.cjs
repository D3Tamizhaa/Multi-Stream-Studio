const http = require('http')
const os = require('os')

let previousCpu = getCpuTimes()

function getCpuTimes() {
  return os.cpus().reduce(
    (total, cpu) => {
      const times = cpu.times

      total.user += times.user
      total.nice += times.nice
      total.sys += times.sys
      total.idle += times.idle
      total.irq += times.irq

      return total
    },
    {
      user: 0,
      nice: 0,
      sys: 0,
      idle: 0,
      irq: 0,
    },
  )
}

function getCpuUsage() {
  const currentCpu = getCpuTimes()

  const idle =
    currentCpu.idle - previousCpu.idle

  const total =
    (currentCpu.user - previousCpu.user) +
    (currentCpu.nice - previousCpu.nice) +
    (currentCpu.sys - previousCpu.sys) +
    idle +
    (currentCpu.irq - previousCpu.irq)

  previousCpu = currentCpu

  if (total <= 0) {
    return 0
  }

  return Math.round(
    ((total - idle) / total) * 100,
  )
}

function getRamUsage() {
  const total = os.totalmem()
  const free = os.freemem()

  return Math.round(
    ((total - free) / total) * 100,
  )
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/system-stats') {
    const data = {
      cpu: getCpuUsage(),
      ram: getRamUsage(),
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    })

    res.end(JSON.stringify(data))
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

server.listen(3001, '127.0.0.1', () => {
  console.log(
    'System stats server running on http://127.0.0.1:3001',
  )
})
