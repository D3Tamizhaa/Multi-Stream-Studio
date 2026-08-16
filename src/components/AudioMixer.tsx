import {
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface AudioMixerProps {
  volume: number
  muted: boolean
  onVolumeChange: (value: number) => void
  onMuteToggle: () => void
}

export function AudioMixer({
  volume,
  muted,
  onVolumeChange,
  onMuteToggle,
}: AudioMixerProps) {
  return (
    <section className="workspace-panel audio-panel">
      <div className="panel-header">
        <h3>Audio Mixer</h3>
      </div>

      <div className="mixer-source">
        <div className="mixer-icon">
          {muted ? (
            <VolumeX size={16} />
          ) : (
            <Volume2 size={16} />
          )}
        </div>

        <div>
          <strong>Media File</strong>
          <span>Audio source</span>
        </div>
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
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
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
              onVolumeChange(Number(event.target.value))
            }
            aria-label="Audio volume"
          />
        </div>
      </div>

      <div className="audio-actions">
        <button type="button">
          <Settings2 size={15} />
          Properties
        </button>
      </div>
    </section>
  )
}
