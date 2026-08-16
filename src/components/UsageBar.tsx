import { useEffect, useState } from 'react'

interface UsageBarProps {
  streaming: boolean
  uptime: number
}

interface SystemStats {
  cpu: number
  ram: number
}

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

export function UsageBar({ streaming, uptime }: UsageBarProps) {
  const [stats, setStats] = useState<SystemStats>({
    cpu: 0,
    ram: 0,
  })

  useEffect(() => {
    let mounted = true

    async function updateStats() {
      try {
        if (!window.systemStats) {
          return
        }

        const nextStats = await window.systemStats.get()

        if (mounted) {
          setStats(nextStats)
        }
      } catch (error) {
        console.error('Failed to read system stats:', error)
      }
    }

    updateStats()

    const interval = window.setInterval(updateStats, 1000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  return (
    <footer className="usage-bar">
      <div className="metric">
        <span>Uptime</span>
        <strong>{formatTime(uptime)}</strong>
      </div>

      <div className="metric">
        <span>Bitrate</span>
        <strong>
          {streaming ? '6000' : '0'} <small>kbit/s</small>
        </strong>
      </div>

      <div className="metric">
        <span>FPS</span>
        <strong>{streaming ? '60' : '0'}</strong>
      </div>

      <div className="metric">
        <span>CPU</span>
        <strong>{stats.cpu.toFixed(0)}%</strong>
      </div>

      <div className="metric">
        <span>RAM</span>
        <strong>{stats.ram.toFixed(0)}%</strong>
      </div>

      <div className="status-metric">
        <span>Status</span>
        <strong className={streaming ? 'online' : 'offline'}>
          <i />
          {streaming ? 'Streaming' : 'Offline'}
        </strong>
      </div>
    </footer>
  )
}
