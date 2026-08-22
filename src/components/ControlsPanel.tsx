import {
  CircleStop,
  Play,
  Radio,
} from 'lucide-react'

import type {
  StreamingStatus,
} from '../types/studio'

interface ControlsPanelProps {
  streaming: boolean
  status: StreamingStatus
  onStart: () => void
  onStop: () => void
}

export function ControlsPanel({
  streaming,
  status,
  onStart,
  onStop,
}: ControlsPanelProps) {
  const starting =
    status === 'starting'

  const stopping =
    status === 'stopping'

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
          disabled={
            streaming ||
            starting ||
            stopping
          }
        >
          <Play
            size={16}
            fill="currentColor"
          />

          {starting
            ? 'Starting Streaming...'
            : 'Start Streaming'}
        </button>

        <button
          type="button"
          className="end-stream-button"
          onClick={onStop}
          disabled={
            !streaming &&
            !starting
          }
        >
          <CircleStop size={16} />

          {stopping
            ? 'Ending Streaming...'
            : 'End Streaming'}
        </button>
      </div>

      <div className="control-note">
        <Radio size={12} />

        {status === 'streaming'
          ? 'FFmpeg streaming active'
          : status === 'starting'
            ? 'Starting FFmpeg'
            : status === 'stopping'
              ? 'Stopping FFmpeg'
              : status === 'error'
                ? 'Streaming error'
                : 'Streaming idle'}
      </div>
    </section>
  )
}
