import { useState } from 'react'
import {
  Mic2,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { Source } from '../types/studio'

interface AudioMixerProps {
  sources: Source[]
}

export function AudioMixer({ sources }: AudioMixerProps) {
  const [volume, setVolume] = useState(80)
  const [muted, setMuted] = useState(false)

  const mediaSources = sources.filter(
    (source) => source.type === 'media'
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
        <div className="audio-mixer-content">
          {mediaSources.map((source) => (
            <div key={source.id} className="mixer-channel">
              <div className="mixer-source">
                <div className="mixer-icon">
                  <Mic2 size={16} />
                </div>

                <div className="mixer-source-info">
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
                  <button
                    type="button"
                    className="mute-button"
                    onClick={() => setMuted((value) => !value)}
                    title={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? (
                      <Volume2 size={15} />
                    ) : (
                      <VolumeX size={15} />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={muted ? 0 : volume}
                    onChange={(event) =>
                      setVolume(Number(event.target.value))
                    }
                    disabled={muted}
                  />
                </div>
              </div>

              <div className="audio-actions">
                <button
                  type="button"
                  onClick={() =>
                    setMuted((value) => !value)
                  }
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
          ))}
        </div>
      )}
    </section>
  )
}
