import { X } from 'lucide-react'
import { useState } from 'react'
import type { Source, SourceType } from '../types/studio'

interface AddSourceModalProps {
  onClose: () => void
  onAdd: (source: Source) => void
  existing?: Source
}

const sourceTypes: {
  type: SourceType
  title: string
  description: string
  icon: string
}[] = [
  {
    type: 'image',
    title: 'Image',
    description: 'Add images to your scene. Supports PNG, JPG, JPEG, GIF, TGA and BMP.',
    icon: '🖼',
  },
  {
    type: 'browser',
    title: 'Browser Source',
    description: 'Add web-based content such as web pages, widgets and streaming video.',
    icon: '🌐',
  },
  {
    type: 'media',
    title: 'Media File',
    description: 'Add videos or audio clips to your scene. Supports MP4, MP3 and WebM.',
    icon: '🎬',
  },
  {
    type: 'text',
    title: 'Text (GDI+)',
    description: 'Add text and adjust its style, font, color and size.',
    icon: 'T',
  },
]

export function AddSourceModal({
  onClose,
  onAdd,
  existing,
}: AddSourceModalProps) {
  const [type, setType] = useState<SourceType>(existing?.type ?? 'image')
  const [name, setName] = useState(existing?.name ?? '')

  const [file, setFile] = useState(
    existing?.properties.file ?? '',
  )

  const [url, setUrl] = useState(
    existing?.properties.url ?? '',
  )

  const [width, setWidth] = useState(
    String(existing?.properties.width ?? 640),
  )

  const [height, setHeight] = useState(
    String(existing?.properties.height ?? 360),
  )

  const [css, setCss] = useState(
    existing?.properties.css ?? '',
  )

  const [loop, setLoop] = useState(
    existing?.properties.loop ?? true,
  )

  const [fontFamily, setFontFamily] = useState(
    existing?.properties.fontFamily ?? 'Inter',
  )

  const [fontSize, setFontSize] = useState(
    String(existing?.properties.fontSize ?? 32),
  )

  const [text, setText] = useState(
    existing?.properties.text ?? 'My Text',
  )

  const [color, setColor] = useState(
    existing?.properties.color ?? '#ffffff',
  )

  const selected = sourceTypes.find((item) => item.type === type)!

  function submit() {
    const source: Source = {
      id: existing?.id ?? `source-${Date.now()}`,
      name: name.trim() || selected.title,
      type,
      visible: existing?.visible ?? true,
      locked: existing?.locked ?? false,
      properties: {
        file,
        url,
        width: Number(width),
        height: Number(height),
        css,
        loop,
        fontFamily,
        fontSize: Number(fontSize),
        text,
        color,
      },
    }

    onAdd(source)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal source-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">SOURCE</span>
            <h2>{existing ? 'Source Properties' : 'Add Source'}</h2>
          </div>

          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {!existing && (
          <div className="source-type-grid">
            {sourceTypes.map((item) => (
              <button
                key={item.type}
                className={type === item.type ? 'active' : ''}
                onClick={() => setType(item.type)}
              >
                <span>{item.icon}</span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>
        )}

        <div className="source-description">
          {selected.description}
        </div>

        <label className="field">
          <span>Please enter the name of the source</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Source name"
          />
        </label>

        {type === 'image' && (
          <label className="field">
            <span>Image File</span>
            <div className="file-row">
  <input
    value={
      file.startsWith('blob:')
        ? 'Selected image'
        : file
    }
    onChange={(event) =>
      setFile(event.target.value)
    }
    placeholder="Select image..."
    readOnly={file.startsWith('blob:')}
  />

  <label className="secondary-button file-picker">
    Browse

    <input
      type="file"
      accept="image/png,image/jpeg,image/gif,image/bmp,image/webp"
      hidden
      onChange={(event) => {
        const selected =
          event.target.files?.[0]

        if (!selected) return

        setFile(
          URL.createObjectURL(selected),
        )
      }}
    />
  </label>
</div>

          </label>
        )}

        {type === 'browser' && (
          <>
            <label className="field">
              <span>URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>

            <div className="settings-grid">
              <label className="field">
                <span>Width</span>
                <input
                  type="number"
                  value={width}
                  onChange={(event) => setWidth(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Height</span>
                <input
                  type="number"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span>Custom CSS</span>
              <textarea
                value={css}
                onChange={(event) => setCss(event.target.value)}
                placeholder=".selector { color: white; }"
              />
            </label>
          </>
        )}

        {type === 'media' && (
          <>
            <label className="field">
              <span>Local File</span>
              <div className="file-row">
                <input
                  value={file}
                  onChange={(event) => setFile(event.target.value)}
                  placeholder="Select media..."
                />
                <button className="secondary-button">Browse</button>
              </div>
            </label>

            <label className="checkbox-setting">
              <input
                type="checkbox"
                checked={loop}
                onChange={(event) => setLoop(event.target.checked)}
              />
              <span>
                <strong>Loop</strong>
                <small>Repeat this media continuously.</small>
              </span>
            </label>
          </>
        )}

        {type === 'text' && (
          <div className="settings-grid">
            <label className="field">
              <span>Font Family</span>
              <input
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Font Size</span>
              <input
                type="number"
                value={fontSize}
                onChange={(event) => setFontSize(event.target.value)}
              />
            </label>

            <label className="field field-wide">
              <span>Text</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Color</span>
              <div className="color-row">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
                <input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
              </div>
            </label>

            <label className="field">
              <span>Width</span>
              <input
                type="number"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Height</span>
              <input
                type="number"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>

          <button className="primary-button" onClick={submit}>
            {existing ? 'Save Changes' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  )
}
