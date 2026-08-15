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
  volume?: number
  muted?: boolean
}

function sourceIcon(type: Source['type']) {
  if (type === 'image') return <ImageIcon size={18} />
  if (type === 'browser') return <Globe size={18} />
  if (type === 'media') return <Music2 size={18} />
  return <Type size={18} />
}

function getSourceUrl(source: Source) {
  if (!source.properties.file) return ''

  // Files stored in /public are referenced from the root.
  return source.properties.file.startsWith('/')
    ? source.properties.file
    : `/${source.properties.file}`
}

function renderSource(
  source: Source,
  volume: number,
  muted: boolean,
) {
  const url = getSourceUrl(source)

  switch (source.type) {
    case 'image':
      return url ? (
        <img
          src={url}
          alt={source.name}
          className="preview-media preview-image"
          draggable={false}
        />
      ) : (
        <div className="preview-placeholder">
          <ImageIcon size={28} />
          <span>No image selected</span>
        </div>
      )

case 'media':
  return url ? (
    <video
      className="preview-media preview-video"
      src={url}
      autoPlay
      muted={muted}
      loop
      playsInline
      controls={false}
      ref={(element) => {
        if (element) {
          element.volume = Math.max(
            0,
            Math.min(1, volume / 100),
          )
        }
      }}
    />
  ) : (
    <div className="preview-placeholder">
      <Music2 size={28} />
      <span>No media file selected</span>
    </div>
  )

    case 'browser':
      return source.properties.url ? (
        <iframe
          src={source.properties.url}
          title={source.name}
          className="preview-browser"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="preview-placeholder">
          <Globe size={28} />
          <span>No browser URL configured</span>
        </div>
      )

    case 'text':
      return (
        <div
          className="preview-text"
          style={{
            fontFamily: source.properties.fontFamily || 'Inter, sans-serif',
            fontSize: `${source.properties.fontSize || 32}px`,
            color: source.properties.color || '#ffffff',
          }}
        >
          {source.properties.text || source.name}
        </div>
      )

    default:
      return null
  }
}

export function PreviewCanvas({
  sources,
  enabled,
  onToggle,
  selectedSource,
  onSelectSource,
  volume = 80,
  muted = false,
}: PreviewCanvasProps) {
  const visibleSources = sources.filter((source) => source.visible)

  return (
    <section className="preview-section">
      <div className="section-heading">
        <div>
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

      <div className={`preview-stage ${!enabled ? 'preview-disabled' : ''}`}>
        <div className="canvas-grid" />

        {enabled ? (
          <div className="canvas-content">
            {visibleSources.length === 0 ? (
              <div className="empty-canvas">
                <ImageIcon size={32} />
                <span>No visible sources</span>
              </div>
            ) : (
              visibleSources.map((source, index) => (
                <button
                  type="button"
                  key={source.id}
                  className={`canvas-layer layer-${index} ${
                    selectedSource === source.id ? 'selected' : ''
                  }`}
                  onClick={() => onSelectSource(source.id)}
                  style={{
                    zIndex: index + 1,
                  }}
                >
                  <div className="source-render">
                    {renderSource(source, volume, muted)}
                  </div>

                  <div className="layer-toolbar">
                    <span className="layer-icon">
                      {sourceIcon(source.type)}
                    </span>

                    <span className="layer-label">
                      {source.type === 'text'
                        ? source.properties.text || source.name
                        : source.name}
                    </span>

                    {source.locked && (
                      <Lock size={12} className="layer-lock" />
                    )}
                  </div>
                </button>
              ))
            )}
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
