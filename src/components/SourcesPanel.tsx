import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Settings2,
  Trash2,
  Unlock,
} from 'lucide-react'
import type { Source } from '../types/studio'

interface SourcesPanelProps {
  sources: Source[]
  selectedSource: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: () => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onProperties: () => void
  onMove: (direction: 'up' | 'down') => void
}

const icons = {
  image: '🖼',
  browser: '🌐',
  media: '🎬',
  text: 'T',
}

export function SourcesPanel({
  sources,
  selectedSource,
  onSelect,
  onAdd,
  onRemove,
  onToggleVisibility,
  onToggleLock,
  onProperties,
  onMove,
}: SourcesPanelProps) {
  return (
    <section className="workspace-panel sources-panel">
      <div className="panel-header">
        <h3>Sources</h3>

        <div className="toolbar">
          <button className="small-icon-button" onClick={onAdd}>
            <Plus size={15} />
          </button>
          <button className="small-icon-button danger" onClick={onRemove}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="list-box">
        {sources.map((source) => (
          <div
            key={source.id}
            className={`source-row ${
              selectedSource === source.id ? 'selected' : ''
            }`}
            onClick={() => onSelect(source.id)}
          >
            <button
              className="source-visibility"
              onClick={(event) => {
                event.stopPropagation()
                onToggleVisibility(source.id)
              }}
            >
              {source.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            <span className={`source-type source-${source.type}`}>
              {icons[source.type]}
            </span>

            <span className="source-name">{source.name}</span>

            <button
              className="source-lock"
              onClick={(event) => {
                event.stopPropagation()
                onToggleLock(source.id)
              }}
            >
              {source.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        ))}
      </div>

      <div className="panel-actions source-actions">
        <button onClick={() => onMove('up')}>
          <ArrowUp size={14} />
          Move Up
        </button>

        <button onClick={() => onMove('down')}>
          <ArrowDown size={14} />
          Move Down
        </button>

        <button
          className="properties-button"
          disabled={!selectedSource}
          onClick={onProperties}
        >
          <Settings2 size={14} />
          Properties
        </button>
      </div>
    </section>
  )
}
