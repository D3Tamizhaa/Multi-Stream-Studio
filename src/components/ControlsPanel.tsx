import { CircleStop, Play, Radio } from 'lucide-react'
import type { StreamingStatus } from '../types/studio'

interface ControlsPanelProps {
  streaming: boolean
  status: StreamingStatus
  onStart: () => void
  onStop: () => void
}

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
  onClick={onStart}
  disabled={streaming}
>
  <Play size={16} fill="currentColor" />
  Start Streaming
</button>

<button
  type="button"
  className="end-stream-button"
  onClick={onStop}
  disabled={!streaming}
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
