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
}

function sourceIcon(type: Source['type']) {
  if (type === 'image') return <ImageIcon size={22} />
  if (type === 'browser') return <Globe size={22} />
  if (type === 'media') return <Music2 size={22} />
  return <Type size={22} />
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
          <h2>Preview</h2>
        </div>

        <label className="toggle-line">
          <input type="checkbox" checked={enabled} onChange={onToggle} />
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

            {visibleSources.map((source, index) => (
              <button
                key={source.id}
                className={`canvas-layer layer-${index} ${
                  selectedSource === source.id ? 'selected' : ''
                }`}
                onClick={() => onSelectSource(source.id)}
              >
                <span className="layer-icon">{sourceIcon(source.type)}</span>

                <span className="layer-label">
                  {source.type === 'text'
                    ? source.properties.text || source.name
                    : source.name}
                </span>

                {source.locked && (
                  <Lock size={12} className="layer-lock" />
                )}
              </button>
            ))}
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
