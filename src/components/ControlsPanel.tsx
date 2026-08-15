import { CircleStop, Play, Radio } from 'lucide-react'

interface ControlsPanelProps {
  streaming: boolean
  onStart: () => void
  onStop: () => void
}

export function ControlsPanel({
  streaming,
  onStart,
  onStop,
}: ControlsPanelProps) {
  return (
    <section className="bottom-panel controls-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">LIVE</span>
          <h3>Controls</h3>
        </div>

        {streaming && (
          <span className="live-badge">
            <span />
            LIVE
          </span>
        )}
      </div>

      <div className="control-buttons">
        <button
          className="start-stream-button"
          disabled={streaming}
          onClick={onStart}
        >
          <Play size={16} fill="currentColor" />
          Start Streaming
        </button>

        <button
          className="end-stream-button"
          disabled={!streaming}
          onClick={onStop}
        >
          <CircleStop size={16} />
          End Streaming
        </button>
      </div>

      <div className="control-note">
        <Radio size={12} />
        {streaming ? 'Streaming is active' : 'Ready to stream'}
      </div>
    </section>
  )
}
