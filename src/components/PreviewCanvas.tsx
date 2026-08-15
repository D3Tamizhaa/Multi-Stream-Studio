import {
  Globe,
  Image as ImageIcon,
  Lock,
  Music2,
  Type,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Source } from '../types/studio'

interface PreviewCanvasProps {
  sources: Source[];
  enabled: boolean;
  onToggle: () => void;
  selectedSource: string | null;
  onSelectSource: (source: string | null) => void;
  volume: number;
  muted: boolean;
}

function sourceIcon(type: Source['type']) {
  if (type === 'image') return <ImageIcon size={16} />
  if (type === 'browser') return <Globe size={16} />
  if (type === 'media') return <Music2 size={16} />
  return <Type size={16} />
}

function renderSource(source: Source) {
  const { properties } = source

  if (source.type === 'image') {
    if (properties.file) {
      return (
        <img
          className="canvas-source-media"
          src={properties.file}
          alt={source.name}
        />
      )
    }

    return (
      <div className="canvas-source-placeholder">
        <ImageIcon size={32} />
        <span>{source.name}</span>
        <small>No image selected</small>
      </div>
    )
  }

  if (source.type === 'media') {
    if (properties.file) {
      return (
        <video
          className="canvas-source-media"
          src={properties.file}
          autoPlay
          muted
          loop={properties.loop ?? true}
          playsInline
        />
      )
    }

    return (
      <div className="canvas-source-placeholder">
        <Music2 size={32} />
        <span>{source.name}</span>
        <small>No media selected</small>
      </div>
    )
  }

  if (source.type === 'browser') {
    if (properties.url) {
      return (
        <iframe
          className="canvas-source-browser"
          src={properties.url}
          title={source.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )
    }

    return (
      <div className="canvas-source-placeholder">
        <Globe size={32} />
        <span>{source.name}</span>
        <small>No URL configured</small>
      </div>
    )
  }

  return (
    <div
      className="canvas-source-text"
      style={{
        color: properties.color || '#ffffff',
        fontFamily: properties.fontFamily || 'Inter, sans-serif',
        fontSize: `${properties.fontSize || 32}px`,
      }}
    >
      {properties.text || source.name}
    </div>
  )
}

export function PreviewCanvas({
  sources,
  enabled,
  onToggle,
  selectedSource,
  onSelectSource,
}: PreviewCanvasProps) {
  const visibleSources = sources.filter((source) => source.visible)

  return (
    <section className="preview-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EDITOR</span>
          <h2>Canvas Preview</h2>
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
            {visibleSources.length === 0 && (
              <div className="empty-canvas">
                <ImageIcon size={32} />
                <span>No visible sources</span>
              </div>
            )}

            {visibleSources.map((source, index) => {
              const width =
                source.properties.width ||
                (source.type === 'text' ? 300 : 640)

              const height =
                source.properties.height ||
                (source.type === 'text' ? 80 : 360)

              const style: CSSProperties = {
                width: `${Math.min(width, 1000) / 10}%`,
                height:
                  source.type === 'text'
                    ? 'auto'
                    : `${Math.min(height, 600) / 6}%`,
                zIndex: index + 1,
              }

              return (
                <button
                  key={source.id}
                  type="button"
                  className={`canvas-layer ${
                    selectedSource === source.id ? 'selected' : ''
                  }`}
                  style={style}
                  onClick={() => onSelectSource(source.id)}
                  title={`Select ${source.name}`}
                >
                  <div className="canvas-source-content">
                    {renderSource(source)}
                  </div>

                  <div className="canvas-layer-toolbar">
                    <span className="layer-icon">
                      {sourceIcon(source.type)}
                    </span>

                    <span className="layer-label">
                      {source.name}
                    </span>

                    {source.locked && (
                      <Lock size={12} className="layer-lock" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="preview-off">
            <span>Preview disabled</span>
          </div>
        )}

        <div className="canvas-resolution">
          1920 × 1080 · EDITOR CANVAS
        </div>
      </div>
    </section>
  )
}
