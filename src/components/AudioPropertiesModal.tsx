import { X } from 'lucide-react'
import type { AudioMonitoringMode } from '../types/studio'

interface AudioPropertiesModalProps {
  monitoringMode: AudioMonitoringMode
  onMonitoringModeChange: (
    mode: AudioMonitoringMode,
  ) => void
  onClose: () => void
}

const monitoringOptions: {
  value: AudioMonitoringMode
  title: string
  description: string
}[] = [
  {
    value: 'off',
    title: 'Monitor Off',
    description:
      'Audio is sent to the stream output only. You will not hear it locally.',
  },
  {
    value: 'monitor-only',
    title: 'Monitor Only',
    description:
      'Audio is played through your local monitor only. Stream output is muted.',
  },
  {
    value: 'monitor-and-output',
    title: 'Monitor and Output',
    description:
      'Audio is played through your local monitor and sent to the stream output.',
  },
]

export function AudioPropertiesModal({
  monitoringMode,
  onMonitoringModeChange,
  onClose,
}: AudioPropertiesModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="modal audio-properties-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">AUDIO MIXER</span>
            <h2>Audio Properties</h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close audio properties"
          >
            <X size={18} />
          </button>
        </div>

        <div className="audio-properties-content">
          <div className="audio-property-label">
            Audio Monitoring
          </div>

          <div className="audio-monitoring-options">
            {monitoringOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`audio-monitoring-option ${
                  monitoringMode === option.value
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  onMonitoringModeChange(option.value)
                }
              >
                <span className="audio-monitoring-radio">
                  <span />
                </span>

                <span className="audio-monitoring-text">
                  <strong>{option.title}</strong>
                  <small>
                    {option.description}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
