import {
  Globe,
  Image as ImageIcon,
  Lock,
  Music2,
  Type,
} from 'lucide-react'
import type { Source } from '../types/studio'

interface PreviewCanvasProps {
  sources: Source[]
  enabled: boolean
  onToggle: () => void
  selectedSource: string | null
  onSelectSource: (id: string) => void
  volume: number
  muted: boolean
}

function sourceIcon(type: Source['type']) {
  if (type === 'image') return <ImageIcon size={22} />
  if (type === 'browser') return <Globe size={22} />
  if (type === 'media') return <Music2 size={22} />
  return <Type size={22} />
}

function getMediaUrl(file?: string) {
  if (!file) return ''

  if (
    file.startsWith('blob:') ||
    file.startsWith('data:') ||
    file.startsWith('http://') ||
    file.startsWith('https://') ||
    file.startsWith('/')
  ) {
    return file
  }

  return `/${file.replace(/^\.?\//, '')}`
}

function isAudioFile(file: string) {
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(file)
}

export function PreviewCanvas({
  sources,
  enabled,
  onToggle,
  selectedSource,
  onSelectSource,
  volume,
  muted,
}: PreviewCanvasProps) {
  const visibleSources = sources.filter((source) => source.visible)

  return (
    <section className="preview-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EDITOR</span>
          <h2>Preview</h2>
        </div>

        <label className="toggle-line">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
          />
          <span>Preview</span>
        </label>
      </div>

      <div
        className={`preview-stage ${
          !enabled ? 'preview-disabled' : ''
        }`}
      >
        <div className="canvas-grid" />

        {enabled ? (
          <div className="canvas-content">
            {visibleSources.length === 0 && (
              <div className="empty-canvas">
                <ImageIcon size={32} />
                <span>No visible sources</span>
              </div>
            )}

            {visibleSources.map((source, index) => {
              const file = getMediaUrl(source.properties.file)

              const width =
                source.properties.width ?? 640

              const height =
                source.properties.height ?? 360

              return (
                <div
                  key={source.id}
                  className={`canvas-layer layer-${index} ${
                    selectedSource === source.id
                      ? 'selected'
                      : ''
                  }`}
                  style={{
                    width,
                    height,
                  }}
                  onClick={() => onSelectSource(source.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      event.preventDefault()
                      onSelectSource(source.id)
                    }
                  }}
                >
                  {source.type === 'image' && file && (
                    <img
                      src={file}
                      alt={source.name}
                      className="preview-media-content"
                    />
                  )}

                  {source.type === 'media' &&
                    file &&
                    (isAudioFile(file) ? (
                      <audio
                        className="preview-audio"
                        src={file}
                        controls
                        autoPlay
                        loop={source.properties.loop ?? true}
                        muted={muted}
                        ref={(element) => {
                          if (element) {
                            element.volume = volume / 100
                          }
                        }}
                      />
                    ) : (
                      <video
                        className="preview-media-content"
                        src={file}
                        controls
                        autoPlay
                        loop={source.properties.loop ?? true}
                        muted={muted}
                        playsInline
                        ref={(element) => {
                          if (element) {
                            element.volume = volume / 100
                          }
                        }}
                      />
                    ))}

                  {source.type === 'browser' &&
                    source.properties.url && (
                      <iframe
                        className="preview-browser"
                        src={source.properties.url}
                        title={source.name}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    )}

                  {source.type === 'text' && (
                    <div
                      className="preview-text"
                      style={{
                        fontFamily:
                          source.properties.fontFamily ??
                          'Inter',
                        fontSize:
                          source.properties.fontSize ?? 32,
                        color:
                          source.properties.color ?? '#ffffff',
                      }}
                    >
                      {source.properties.text ||
                        source.name}
                    </div>
                  )}

                  {!file &&
                    source.type !== 'browser' &&
                    source.type !== 'text' && (
                      <div className="empty-source">
                        {sourceIcon(source.type)}
                        <span>No media selected</span>
                      </div>
                    )}

                  <div className="layer-overlay">
                    <span className="layer-icon">
                      {sourceIcon(source.type)}
                    </span>

                    <span className="layer-label">
                      {source.type === 'text'
                        ? source.properties.text ||
                          source.name
                        : source.name}
                    </span>

                    {source.locked && (
                      <Lock
                        size={12}
                        className="layer-lock"
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="preview-off">
            <span>Preview disabled</span>
          </div>
        )}

        <div className="canvas-resolution">
          1920 × 1080
        </div>
      </div>
    </section>
  )
}
