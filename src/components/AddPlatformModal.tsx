import { X } from 'lucide-react'
import { useState } from 'react'
import type { Platform, PlatformName } from '../types/studio'

interface AddPlatformModalProps {
  onClose: () => void
  onAdd: (platform: Platform) => void
  existing?: Platform
}

export function AddPlatformModal({
  onClose,
  onAdd,
  existing,
}: AddPlatformModalProps) {
  const [name, setName] = useState<PlatformName>(
    existing?.name ?? 'YouTube',
  )

  const [server, setServer] = useState<string>(
    existing?.server ?? '',
  )

  const [streamKey, setStreamKey] = useState<string>(
    existing?.streamKey ?? '',
  )

  function submit() {
    const platform: Platform = {
      id: existing?.id ?? `platform-${Date.now()}`,
      name: name,
      server: server,
      streamKey: streamKey,
      enabled: existing?.enabled ?? true,
    }

    onAdd(platform)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">PLATFORM</span>
            <h2>{existing ? 'Edit Platform' : 'Add Platform'}</h2>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-form">
          <label className="field">
            <span>Platform</span>

            <select
              value={name}
              onChange={(event) =>
                setName(event.target.value as PlatformName)
              }
            >
              <option value="YouTube">YouTube</option>
              <option value="Facebook">Facebook</option>
              <option value="Twitch">Twitch</option>
              <option value="Kick">Kick</option>
              <option value="Custom">Custom</option>
            </select>
          </label>

          <label className="field">
            <span>Server</span>

            <input
              value={server}
              onChange={(event) => setServer(event.target.value)}
              placeholder="rtmp://..."
            />
          </label>

          <label className="field">
            <span>Stream Key</span>

            <input
              type="password"
              value={streamKey}
              onChange={(event) => setStreamKey(event.target.value)}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={onClose}
            type="button"
          >
            Close
          </button>

          <button
            className="primary-button"
            onClick={submit}
            type="button"
          >
            {existing ? 'Save' : 'Add Platform'}
          </button>
        </div>
      </div>
    </div>
  )
}
