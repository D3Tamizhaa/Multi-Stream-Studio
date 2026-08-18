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

  const [server, setServer] = useState(existing?.server ?? '')
  const [streamKey, setStreamKey] = useState(existing?.streamKey ?? '')

  function submit() {
    onAdd({
      id: existing?.id ?? `platform-${Date.now()}`,
      name,
      server,
      streamKey,
      enabled: existing?.enabled ?? true,
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">PLATFORM</span>
            <h2>{existing ? 'Edit Platform' : 'Add Platform'}</h2>
          </div>

          <button className="icon-button" onClick={onClose}>
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
              <option>YouTube</option>
              <option>Facebook</option>
              <option>Twitch</option>
              <option>Kick</option>
              <option>Custom</option>
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
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>

          <button className="primary-button" onClick={submit}>
            {existing ? 'Save' : 'Add Platform'}
          </button>
        </div>
      </div>
    </div>
  )
}
