import { X } from 'lucide-react'
import { useState } from 'react'

interface AddSceneModalProps {
  onClose: () => void
  onAdd: (name: string) => void
}

export function AddSceneModal({
  onClose,
  onAdd,
}: AddSceneModalProps) {
  const [name, setName] = useState('')

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">SCENES</span>
            <h2>Add Scene</h2>
          </div>

          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="field">
          <span>Please enter the name of the scene</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Scene name"
          />
        </label>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>

          <button
            className="primary-button"
            disabled={!name.trim()}
            onClick={() => onAdd(name.trim())}
          >
            Add Scene
          </button>
        </div>
      </div>
    </div>
  )
}
