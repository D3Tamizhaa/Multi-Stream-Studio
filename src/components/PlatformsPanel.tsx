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
  selectedPlatform: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: () => void
  onToggle: (id: string) => void
  onEdit: (platform: Platform) => void
}

export function PlatformsPanel({
  platforms,
  selectedPlatform,
  onSelect,
  onAdd,
  onRemove,
  onToggle,
  onEdit,
}: PlatformsPanelProps) {
  return (
    <section className="bottom-panel">
      <div className="panel-header">
        <div>
          <h3>Platforms</h3>
        </div>

        <div className="toolbar">
          <button
            className="small-icon-button"
            onClick={onAdd}
            title="Add platform"
          >
            <Plus size={15} />
          </button>

          <button
            className="small-icon-button danger"
            onClick={onRemove}
            disabled={!selectedPlatform}
            title="Remove platform"
          >
            <Minus size={15} />
          </button>
        </div>
      </div>

      <div className="platform-list">
        {platforms.map((platform) => (
          <div
            className={`platform-row ${
              selectedPlatform === platform.id ? 'selected' : ''
            }`}
            key={platform.id}
            onClick={() => onSelect(platform.id)}
          >
            <button
              className={`platform-check ${
                platform.enabled ? 'checked' : ''
              }`}
              onClick={(event) => {
                event.stopPropagation()
                onToggle(platform.id)
              }}
              title={
                platform.enabled
                  ? 'Disable platform'
                  : 'Enable platform'
              }
            >
              {platform.enabled && <Check size={13} />}
            </button>

            <Radio size={15} />

            <span className="platform-name">
              {platform.name}
            </span>

            <button
              className="edit-platform"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(platform)
              }}
            >
              <Pencil size={13} />
              Edit
            </button>
          </div>
        ))}

        {platforms.length === 0 && (
          <div className="platform-empty">
            No platforms added
          </div>
        )}
      </div>
    </section>
  )
}
