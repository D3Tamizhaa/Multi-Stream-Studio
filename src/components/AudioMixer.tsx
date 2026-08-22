import {
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { AudioMonitoringMode } from '../types/studio'

interface AudioMixerProps {
  volume: number
  muted: boolean
  monitoringMode: AudioMonitoringMode
  onVolumeChange: (value: number) => void
  onMuteToggle: () => void
  onProperties: () => void
}

const monitoringLabels: Record<
  AudioMonitoringMode,
  string
> = {
  off: 'Monitor Off',
  'monitor-only': 'Monitor Only',
  'monitor-and-output': 'Monitor and Output',
}

export function AudioMixer({
  volume,
  muted,
  monitoringMode,
  onVolumeChange,
  onMuteToggle,
  onProperties,
}: AudioMixerProps) {
  return (
    <section className="workspace-panel audio-panel">
      <div className="panel-header">
        <h3>Audio Mixer</h3>
      </div>

      <div className="volume-block">
        <div className="volume-label">
          <span>Volume</span>
          <strong>{volume}%</strong>
        </div>

        <div className="slider-row">
          <button
            type="button"
            className={`volume-mute-button ${
              muted ? 'muted' : ''
            }`}
            onClick={onMuteToggle}
            aria-label={
              muted
                ? 'Unmute audio'
                : 'Mute audio'
            }
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <VolumeX size={14} />
            ) : (
              <Volume2 size={14} />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) =>
              onVolumeChange(
                Number(event.target.value),
              )
            }
            aria-label="Audio volume"
          />
        </div>
      </div>

      <div className="audio-monitoring-summary">
        <span>Monitoring</span>
        <strong>
          {monitoringLabels[monitoringMode]}
        </strong>
      </div>

      <div className="audio-actions">
        <button
          type="button"
          onClick={onProperties}
        >
          <Settings2 size={15} />
          Properties
        </button>
      </div>
    </section>
  )
}
