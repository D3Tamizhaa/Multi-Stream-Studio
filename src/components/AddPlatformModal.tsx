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
  const initialName: PlatformName = existing?.name ?? 'YouTube'
  const initialServer: string = existing?.server ?? ''
  const initialStreamKey: string = existing?.streamKey ?? ''

  const [name, setName] = useState<PlatformName>(initialName)
  const [server, setServer] = useState<string>(initialServer)
  const [streamKey, setStreamKey] = useState<string>(initialStreamKey)

  function submit() {
    const platform: Platform = {
      id: existing?.id ?? `platform-${Date.now()}`,
      name,
      server,
      streamKey,
      enabled: existing?.enabled ?? true,
    }

    onAdd(platform)
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">PLATFORM</span>
            <h2>
              {existing ? 'Edit Platform' : 'Add Platform'}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-form">
          <label className="field">
            <span>Platform</span>

            <select
              value={name}
              onChange={(event) => {
                const value = event.target.value

                if (
                  value === 'YouTube' ||
                  value === 'Facebook' ||
                  value === 'Twitch' ||
                  value === 'Kick' ||
                  value === 'Custom'
                ) {
                  setName(value)
                }
              }}
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
              type="text"
              value={server}
              onChange={(event) => {
                setServer(event.target.value)
              }}
              placeholder="rtmp://..."
            />
          </label>

          <label className="field">
            <span>Stream Key</span>

            <input
              type="password"
              value={streamKey}
              onChange={(event) => {
                setStreamKey(event.target.value)
              }}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={submit}
          >
            {existing ? 'Save' : 'Add Platform'}
          </button>
        </div>
      </div>
    </div>
  )
}
