interface UsageBarProps {
  streaming: boolean
  uptime: number
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

export function UsageBar({
  streaming,
  uptime,
  cpu,
  ram,
}: UsageBarProps) {
  return (
    <footer className="usage-bar">
      <div className="metric">
        <span>Uptime</span>
        <strong>{formatTime(uptime)}</strong>
      </div>

      <div className="metric">
        <span>Bitrate</span>
        <strong>
          {streaming ? '6000' : '0'}{' '}
          <small>kbit/s</small>
        </strong>
      </div>

      <div className="metric">
        <span>FPS</span>
        <strong>{streaming ? '60' : '0'}</strong>
      </div>

      <div className="metric">
        <span>CPU</span>
        <strong>{cpu.toFixed(1)}%</strong>
      </div>

      <div className="metric">
        <span>RAM</span>
        <strong>{ram.toFixed(1)} MB</strong>
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
