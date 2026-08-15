import {
  Mic2,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface AudioMixerProps {
  volume: number
  muted: boolean
  onVolumeChange: (volume: number) => void
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
          <Mic2 size={16} />
        </div>

        <div>
          <strong>Media File</strong>
          <span>Preview audio</span>
        </div>
      </div>

      <div className="volume-block">
        <div className="volume-label">
          <span>Volume</span>
          <strong>{muted ? 0 : volume}%</strong>
        </div>

        <div className="slider-row">
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}

          <input
            type="range"
            min="0"
            max="100"
            value={muted ? 0 : volume}
            onChange={(event) =>
              onVolumeChange(Number(event.target.value))
            }
            aria-label="Media volume"
          />
        </div>
      </div>

      <div className="audio-actions">
        <button
          className={muted ? 'danger-text' : ''}
          onClick={onMuteToggle}
          type="button"
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          {muted ? 'Unmute' : 'Mute'}
        </button>

        <button type="button">
          <Settings2 size={15} />
          Properties
        </button>
      </div>
    </section>
  )
}
