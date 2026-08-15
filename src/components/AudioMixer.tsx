import {
  Mic2,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'

import type { Source } from '../types/studio'

interface AudioMixerProps {
  sources: Source[]
  volume: number
  muted: boolean
  onVolumeChange: (volume: number) => void
  onMuteToggle: () => void
}

export function AudioMixer({
  sources,
  volume,
  muted,
  onVolumeChange,
  onMuteToggle,
}: AudioMixerProps) {
  const mediaSources = sources.filter(
    (source) => source.type === 'media',
  )

  return (
    <section className="workspace-panel audio-panel">
      <div className="panel-header">
        <h3>Audio Mixer</h3>
      </div>

      {mediaSources.length === 0 ? (
        <div className="empty-panel-state">
          No audio source
        </div>
      ) : (
        mediaSources.map((source) => (
          <div key={source.id}>
            <div className="mixer-source">
              <div className="mixer-icon">
                <Mic2 size={16} />
              </div>

              <div>
                <strong>{source.name}</strong>
                <span>Audio source</span>
              </div>
            </div>

            <div className="volume-block">
              <div className="volume-label">
                <span>Volume</span>

                <strong>
                  {muted ? 0 : volume}%
                </strong>
              </div>

              <div className="slider-row">
                {muted ? (
                  <VolumeX size={14} />
                ) : (
                  <Volume2 size={14} />
                )}

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={muted ? 0 : volume}
                  onChange={(event) =>
                    onVolumeChange(
                      Number(event.target.value),
                    )
                  }
                  disabled={muted}
                />
              </div>
            </div>

            <div className="audio-actions">
              <button
                type="button"
                className={muted ? 'danger-text' : ''}
                onClick={onMuteToggle}
              >
                {muted ? (
                  <Volume2 size={15} />
                ) : (
                  <VolumeX size={15} />
                )}

                {muted ? 'Unmute' : 'Mute'}
              </button>

              <button type="button">
                <Settings2 size={15} />
                Properties
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
