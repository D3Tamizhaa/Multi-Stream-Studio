export function UsageBar() {
  return (
    <footer className="usage-bar">
      <div className="metric">
        <span>Uptime</span>
        <strong>--</strong>
      </div>

      <div className="metric">
        <span>Bitrate</span>
        <strong>
          -- <small>kbit/s</small>
        </strong>
      </div>

      <div className="metric">
        <span>FPS</span>
        <strong>--</strong>
      </div>

      <div className="metric">
        <span>CPU</span>
        <strong>--</strong>
      </div>

      <div className="metric">
        <span>RAM</span>
        <strong>--</strong>
      </div>

      <div className="status-metric">
        <span>Status</span>
        <strong className="offline">
          <i />
          Offline
        </strong>
      </div>
    </footer>
  )
}
