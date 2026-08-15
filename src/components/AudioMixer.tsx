import { Mic2, Settings2, Volume2, VolumeX } from 'lucide-react'
import { useState } from 'react'

export function AudioMixer() {
  const [volume, setVolume] = useState(80)
  const [muted, setMuted] = useState(false)

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
          <span>Audio source</span>
        </div>
      </div>

      <div className="volume-block">
        <div className="volume-label">
          <span>Volume</span>
          <strong>{muted ? 0 : volume}%</strong>
        </div>

        <div className="slider-row">
          <Volume2 size={14} />

          <input
            type="range"
            min="0"
            max="100"
            value={muted ? 0 : volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            disabled={muted}
          />
        </div>
      </div>

      <div className="audio-actions">
        <button
          className={muted ? 'danger-text' : ''}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX size={15} /> : <VolumeX size={15} />}
          {muted ? 'Unmute' : 'Mute'}
        </button>

        <button>
          <Settings2 size={15} />
          Properties
        </button>
      </div>
    </section>
  )
}
