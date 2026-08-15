import {
  Check,
  Minus,
  Pencil,
  Plus,
  Radio,
} from 'lucide-react'
import type { Platform } from '../types/studio'

interface PlatformsPanelProps {
  platforms: Platform[]
  onAdd: () => void
  onRemove: () => void
  onToggle: (id: string) => void
  onEdit: (platform: Platform) => void
}

export function PlatformsPanel({
  platforms,
  onAdd,
  onRemove,
  onToggle,
  onEdit,
}: PlatformsPanelProps) {
  return (
    <section className="bottom-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">STREAM</span>
          <h3>Platforms</h3>
        </div>

        <div className="toolbar">
          <button className="small-icon-button" onClick={onAdd}>
            <Plus size={15} />
          </button>
          <button className="small-icon-button danger" onClick={onRemove}>
            <Minus size={15} />
          </button>
        </div>
      </div>

      <div className="platform-list">
        {platforms.map((platform) => (
          <div className="platform-row" key={platform.id}>
            <button
              className={`platform-check ${
                platform.enabled ? 'checked' : ''
              }`}
              onClick={() => onToggle(platform.id)}
            >
              {platform.enabled && <Check size={13} />}
            </button>

            <Radio size={15} />

            <span className="platform-name">{platform.name}</span>

            <button
              className="edit-platform"
              onClick={() => onEdit(platform)}
            >
              <Pencil size={13} />
              Edit
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
