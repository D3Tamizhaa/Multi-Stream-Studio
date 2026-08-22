import { CircleStop, Play, Radio } from 'lucide-react'

export function ControlsPanel() {
  return (
    <section className="bottom-panel controls-panel">
      <div className="panel-header">
        <div>
          <h3>Controls</h3>
        </div>
      </div>

      <div className="control-buttons">
        <button
          type="button"
          className="start-stream-button"
          disabled
        >
          <Play size={16} fill="currentColor" />
          Start Streaming
        </button>

        <button
          type="button"
          className="end-stream-button"
          disabled
        >
          <CircleStop size={16} />
          End Streaming
        </button>
      </div>

      <div className="control-note">
        <Radio size={12} />
        Streaming controls unavailable
      </div>
    </section>
  )
}
