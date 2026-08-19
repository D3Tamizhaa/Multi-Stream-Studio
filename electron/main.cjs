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


statsServer.on('error', (error) => {
  console.error(
    'System stats server error:',
    error,
  )
})
