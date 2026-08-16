import {
  Image as ImageIcon,
  Music2,
  Globe,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Source } from '../types/studio'

interface PreviewCanvasProps {
  sources: Source[]
  enabled: boolean
  onToggle: () => void
  selectedSource: string | null
  onSelectSource: (id: string) => void
  onUpdateSource: (
    id: string,
    properties: Partial<Source['properties']>,
  ) => void
  volume?: number
  muted?: boolean
}

function parseResolution(value: string) {
  const match = value.match(/^(\d+)\s*x\s*(\d+)$/i)

  if (!match) {
    return {
      width: 1920,
      height: 1080,
    }
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080

type Interaction =
  | {
      type: 'drag'
      sourceId: string
      startX: number
      startY: number
      sourceX: number
      sourceY: number
      width: number
      height: number
    }
  | {
      type: 'resize'
      sourceId: string
      startX: number
      startY: number
      sourceX: number
      sourceY: number
      width: number
      height: number
      fontSize: number
    }
  | null

function getSourceBounds(source: Source) {
  const width = source.properties.width ?? 640
  const height = source.properties.height ?? 360

  return {
    x:
      source.properties.x ??
      (CANVAS_WIDTH - width) / 2,
    y:
      source.properties.y ??
      (CANVAS_HEIGHT - height) / 2,
    width,
    height,
  }
}

function getSourceUrl(source: Source) {
  if (!source.properties.file) return ''

  return source.properties.file.startsWith('/')
    ? source.properties.file
    : `/${source.properties.file}`
}

function renderSource(
  source: Source,
  volume: number,
  muted: boolean,
) {
  const url = getSourceUrl(source)

  switch (source.type) {
    case 'image':
      return url ? (
        <img
          src={url}
          alt=""
          className="preview-media preview-image"
          draggable={false}
        />
      ) : (
        <div className="preview-placeholder">
          <ImageIcon size={28} />
        </div>
      )

    case 'media':
      return url ? (
        <video
          className="preview-media preview-video"
          src={url}
          autoPlay
          muted={muted}
          loop
          playsInline
          controls={false}
          ref={(element) => {
            if (element) {
              element.volume = Math.max(
                0,
                Math.min(1, volume / 100),
              )
            }
          }}
        />
      ) : (
        <div className="preview-placeholder">
          <Music2 size={28} />
        </div>
      )

    case 'browser':
      return source.properties.url ? (
        <iframe
          src={source.properties.url}
          title="Browser source"
          className="preview-browser"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="preview-placeholder">
          <Globe size={28} />
        </div>
      )

    case 'text':
      return (
        <div
          className="preview-text"
          style={{
            fontFamily:
              source.properties.fontFamily ||
              'Inter, sans-serif',
            fontSize: `${
              source.properties.fontSize || 32
            }px`,
            color:
              source.properties.color || '#ffffff',
          }}
        >
          {source.properties.text || source.name}
        </div>
      )

    default:
      return null
  }
}

export function PreviewCanvas({
  sources,
  enabled,
  onToggle,
  selectedSource,
  onSelectSource,
  onUpdateSource,
  volume = 80,
  muted = false,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const interactionRef =
    useRef<Interaction>(null)

  const [, forceUpdate] = useState(0)

  const { width: canvasWidth, height: canvasHeight } =
    parseResolution('1920x1080')

  const visibleSources = sources.filter(
    (source) => source.visible,
  )

  function beginDrag(
    event: React.PointerEvent<HTMLDivElement>,
    source: Source,
  ) {
    if (source.locked) return

    event.preventDefault()
    event.stopPropagation()

    const bounds = getSourceBounds(source)

    interactionRef.current = {
      type: 'drag',
      sourceId: source.id,
      startX: event.clientX,
      startY: event.clientY,
      sourceX: bounds.x,
      sourceY: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }

    onSelectSource(source.id)
  }

  function beginResize(
    event: React.PointerEvent<HTMLDivElement>,
    source: Source,
  ) {
    if (source.locked) return

    event.preventDefault()
    event.stopPropagation()

    const bounds = getSourceBounds(source)

    interactionRef.current = {
      type: 'resize',
      sourceId: source.id,
      startX: event.clientX,
      startY: event.clientY,
      sourceX: bounds.x,
      sourceY: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fontSize:
        source.properties.fontSize ?? 32,
    }

    onSelectSource(source.id)
  }

  useEffect(() => {
    function handlePointerMove(
      event: PointerEvent,
    ) {
      const interaction =
        interactionRef.current

      if (!interaction) return

      const canvas = canvasRef.current

      if (!canvas) return

      const rect = canvas.getBoundingClientRect()

      const deltaX =
        ((event.clientX -
          interaction.startX) /
          rect.width) *
        CANVAS_WIDTH

      const deltaY =
        ((event.clientY -
          interaction.startY) /
          rect.height) *
        CANVAS_HEIGHT

      if (interaction.type === 'drag') {
        const x = Math.max(
          0,
          Math.min(
            CANVAS_WIDTH -
              interaction.width,
            interaction.sourceX + deltaX,
          ),
        )

        const y = Math.max(
          0,
          Math.min(
            CANVAS_HEIGHT -
              interaction.height,
            interaction.sourceY + deltaY,
          ),
        )

        onUpdateSource(
          interaction.sourceId,
          {
            x,
            y,
          },
        )
      }

      if (interaction.type === 'resize') {
        const width = Math.max(
          40,
          Math.min(
            CANVAS_WIDTH -
              interaction.sourceX,
            interaction.width + deltaX,
          ),
        )

        const height = Math.max(
          30,
          Math.min(
            CANVAS_HEIGHT -
              interaction.sourceY,
            interaction.height + deltaY,
          ),
        )

        const source = sources.find(
          (item) =>
            item.id === interaction.sourceId,
        )

        if (!source) return

        const properties: Partial<
          Source['properties']
        > = {
          width,
          height,
        }

        if (source.type === 'text') {
          const scale =
            height / interaction.height

          properties.fontSize =
            Math.max(
              8,
              Math.round(
                interaction.fontSize *
                  scale,
              ),
            )
        }

        onUpdateSource(
          interaction.sourceId,
          properties,
        )
      }

      forceUpdate((value) => value + 1)
    }

    function handlePointerUp() {
      interactionRef.current = null
    }

    window.addEventListener(
      'pointermove',
      handlePointerMove,
    )

    window.addEventListener(
      'pointerup',
      handlePointerUp,
    )

    return () => {
      window.removeEventListener(
        'pointermove',
        handlePointerMove,
      )

      window.removeEventListener(
        'pointerup',
        handlePointerUp,
      )
    }
  }, [sources, onUpdateSource])

    return (
   <section className="preview-section">
  <div className="section-heading">
    <div>
      <h2>Preview</h2>
    </div>

    <label className="toggle-line">
      ...
      <span>Preview</span>
    </label>
  </div>

        className={`preview-stage ${
          !enabled ? 'preview-disabled' : ''
        }`}
      >

        <div className="canvas-grid" />
        
        <div className="safe-area safe-area-outer" />
        <div className="safe-area safe-area-inner" />

        
        {enabled ? (
          <div
            ref={canvasRef}
            className="canvas-content"
            style={{
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                onSelectSource('')
              }
            }}
          >
            {visibleSources.length === 0 ? (
              <div className="empty-canvas">
                <ImageIcon size={32} />
                <span>No visible sources</span>
              </div>
            ) : (
              visibleSources.map((source, index) => {
                const bounds = getSourceBounds(source)

                const left =
                  (bounds.x / CANVAS_WIDTH) * 100

                const top =
                  (bounds.y / CANVAS_HEIGHT) * 100

                const width =
                  (bounds.width / CANVAS_WIDTH) * 100

                const height =
                  (bounds.height / CANVAS_HEIGHT) * 100

                const isSelected =
                  selectedSource === source.id

                return (
                  <div
                    key={source.id}
                    className={`canvas-layer ${
                      isSelected ? 'selected' : ''
                    }`}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      zIndex: index + 1,
                    }}
                    onPointerDown={(event) =>
                      beginDrag(event, source)
                    }
                  >
                    <div className="source-render">
                      {renderSource(
                        source,
                        volume,
                        muted,
                      )}
                    </div>

                    {isSelected && !source.locked && (
                      <div
                        className="resize-handle"
                        onPointerDown={(event) =>
                          beginResize(event, source)
                        }
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="preview-off">
            <span>Preview disabled</span>
          </div>
        )}

        {/* SAFE AREA - SAME SIZE AS PREVIEW */}
        <div className="safe-area-overlay" />

        {/* Resolution */}
        <div className="canvas-resolution">
          {canvasWidth} × {canvasHeight}
        </div>

        {/* Preview checkbox - bottom right */}
        <label className="preview-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
          />
          <span>Preview</span>
        </label>
      </div>
    </section>
  )
}
