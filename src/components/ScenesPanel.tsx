import {
  ArrowDown,
  ArrowUp,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import type { Scene } from '../types/studio'

interface ScenesPanelProps {
  scenes: Scene[]
  activeScene: string
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: () => void
  onProperties: () => void
  onMove: (direction: 'up' | 'down') => void
}

export function ScenesPanel({
  scenes,
  activeScene,
  onSelect,
  onAdd,
  onRemove,
  onProperties,
  onMove,
}: ScenesPanelProps) {
  return (
    <section className="workspace-panel">
      <div className="panel-header">
        <h3>Scenes</h3>

        <div className="toolbar">
          <button className="small-icon-button" onClick={onAdd} title="Add scene">
            <Plus size={15} />
          </button>
          <button className="small-icon-button danger" onClick={onRemove} title="Remove scene">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="list-box scene-list">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            className={`list-row ${activeScene === scene.id ? 'selected' : ''}`}
            onClick={() => onSelect(scene.id)}
          >
            <span>{scene.name}</span>
          </button>
        ))}
      </div>

<div className="panel-actions">
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
    onClick={onProperties}
    title="Scene properties"
  >
    <Settings2 size={14} />
    Properties
  </button>
</div>
    </section>
  )
}
