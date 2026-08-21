import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ScenePropertiesModalProps {
  sceneName: string
  onClose: () => void
  onSave: (name: string) => void
}

export function ScenePropertiesModal({
  sceneName,
  onClose,
  onSave,
}: ScenePropertiesModalProps) {
  const [name, setName] = useState(sceneName)

  useEffect(() => {
    setName(sceneName)
  }, [sceneName])

  function handleSave() {
    const trimmedName = name.trim()

    if (!trimmedName) return

    onSave(trimmedName)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">SCENES</span>
            <h2>Scene Properties</h2>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <label className="field">
          <span>Scene name</span>

          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSave()
              }
            }}
            placeholder="Scene name"
          />
        </label>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={onClose}
          >
            Close
          </button>

          <button
            className="primary-button"
            disabled={!name.trim()}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
