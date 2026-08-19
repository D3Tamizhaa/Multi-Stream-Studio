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
import type {
  AudioMonitoringMode,
  Source,
} from '../types/studio'

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
  monitoringMode?: AudioMonitoringMode
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
      startClientX: number
      startClientY: number
      startX: number
      startY: number
      width: number
      height: number
    }
  | {
    type: 'resize'
    sourceId: string
    handle: 'nw' | 'ne' | 'sw' | 'se'
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    width: number
    height: number
    aspectRatio: number
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
  const file = source.properties.file?.trim()

  if (!file) return ''

  if (
    file.startsWith('blob:') ||
    file.startsWith('data:') ||
    /^https?:\/\//i.test(file) ||
    file.startsWith('file:')
  ) {
    return file
  }

  return file.startsWith('/') ? file : `/${file}`
}

function renderSource(
  source: Source,
  volume: number,
  muted: boolean,
  monitoringMode: AudioMonitoringMode,
) {
  const url = getSourceUrl(source)

  switch (source.type) {
    case 'image':
      return url ? (
        <img
          src={url}
          alt={source.name}
          className="preview-media preview-image"
          draggable={false}
          onError={(event) => {
            console.error(
              'Image preview failed:',
              source.name,
              url,
              event.currentTarget,
            )
          }}
        />
      ) : (
        <div className="preview-placeholder">
          <ImageIcon size={28} />
          <span>No image selected</span>
        </div>
      )

    case 'media':
      return url ? (
        <video
          className="preview-media preview-video"
          src={url}
          autoPlay
          muted={
            muted ||
            monitoringMode === 'off'
          }
          loop={source.properties.loop ?? true}
          playsInline
          preload="auto"
          controls={false}
  onLoadedData={(event) => {
  const video = event.currentTarget

  video.volume = Math.max(
    0,
    Math.min(1, volume / 100),
  )

  video.muted =
    muted ||
    monitoringMode === 'off'

  video.play().catch((error) => {
    console.warn(
      'Video autoplay was blocked:',
      error,
    )
  })
}}

          onError={(event) => {
            console.error(
              'Video preview failed:',
              source.name,
              url,
              event.currentTarget.error,
            )
          }}
        />
      ) : (
        <div className="preview-placeholder">
          <Music2 size={28} />
          <span>No media selected</span>
        </div>
      )

    case 'browser':
      return source.properties.url ? (
        <iframe
          src={source.properties.url}
          title={source.name}
          className="preview-browser"
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="preview-placeholder">
          <Globe size={28} />
          <span>No URL configured</span>
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
  monitoringMode = 'off',
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const streamCanvasRef = useRef<HTMLCanvasElement>(null)
  const interactionRef =
    useRef<Interaction>(null)

  const [, forceUpdate] = useState(0)

    useEffect(() => {
    const videos =
      canvasRef.current?.querySelectorAll('video')

    if (!videos) return

    videos.forEach((video) => {
      video.volume = Math.max(
        0,
        Math.min(1, volume / 100),
      )

      video.muted =
        muted ||
        monitoringMode === 'off'
    })
  }, [
    volume,
    muted,
    monitoringMode,
    sources,
  ])

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

  event.currentTarget.setPointerCapture(event.pointerId)

  interactionRef.current = {
    type: 'drag',
    sourceId: source.id,

    startClientX: event.clientX,
    startClientY: event.clientY,

    startX: bounds.x,
    startY: bounds.y,

    width: bounds.width,
    height: bounds.height,
  }

  onSelectSource(source.id)
}

function beginResize(
  event: React.PointerEvent<HTMLDivElement>,
  source: Source,
  handle: 'nw' | 'ne' | 'sw' | 'se',
) {
  if (source.locked) return

  event.preventDefault()
  event.stopPropagation()

  const bounds = getSourceBounds(source)

  event.currentTarget.setPointerCapture(event.pointerId)

  interactionRef.current = {
    type: 'resize',
    sourceId: source.id,
    handle,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: bounds.x,
    startY: bounds.y,
    width: bounds.width,
    height: bounds.height,
    aspectRatio: bounds.width / Math.max(bounds.height, 1),
    fontSize: source.properties.fontSize ?? 32,
  }

  onSelectSource(source.id)
}
  useEffect(() => {
  function handlePointerMove(event: PointerEvent) {
    const interaction = interactionRef.current

    if (!interaction) return

    const canvas = canvasRef.current

    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    if (!rect.width || !rect.height) return

    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height

    const deltaX =
      (event.clientX - interaction.startClientX) *
      scaleX

    const deltaY =
      (event.clientY - interaction.startClientY) *
      scaleY

    if (interaction.type === 'drag') {
      const x = Math.max(
        0,
        Math.min(
          CANVAS_WIDTH - interaction.width,
          interaction.startX + deltaX,
        ),
      )

      const y = Math.max(
        0,
        Math.min(
          CANVAS_HEIGHT - interaction.height,
          interaction.startY + deltaY,
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
  const minWidth = 40
  const minHeight = 30

  const {
    startX,
    startY,
    width: startWidth,
    height: startHeight,
    aspectRatio,
    handle,
  } = interaction

  let width = startWidth
  let height = startHeight

  // Calculate raw size based on the corner being dragged.
  switch (handle) {
    case 'se':
      width = startWidth + deltaX
      height = startHeight + deltaY
      break

    case 'sw':
      width = startWidth - deltaX
      height = startHeight + deltaY
      break

    case 'ne':
      width = startWidth + deltaX
      height = startHeight - deltaY
      break

    case 'nw':
      width = startWidth - deltaX
      height = startHeight - deltaY
      break
  }

  width = Math.max(minWidth, width)
  height = Math.max(minHeight, height)

  // Preserve aspect ratio.
  if (aspectRatio > 0) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      height = Math.max(minHeight, width / aspectRatio)
    } else {
      width = Math.max(minWidth, height * aspectRatio)
    }
  }

  // Keep the opposite corner fixed.
  let x = startX
  let y = startY

  if (handle === 'nw' || handle === 'sw') {
    x = startX + startWidth - width
  }

  if (handle === 'nw' || handle === 'ne') {
    y = startY + startHeight - height
  }

  // Keep inside the canvas.
  if (x < 0) {
    width += x
    x = 0
  }

  if (y < 0) {
    height += y
    y = 0
  }

  if (x + width > CANVAS_WIDTH) {
    width = CANVAS_WIDTH - x
  }

  if (y + height > CANVAS_HEIGHT) {
    height = CANVAS_HEIGHT - y
  }

  width = Math.max(minWidth, width)
  height = Math.max(minHeight, height)

  const source = sources.find(
    (item) => item.id === interaction.sourceId,
  )

  if (!source) return

  const properties: Partial<Source['properties']> = {
    x,
    y,
    width,
    height,
  }

  if (source.type === 'text') {
    const scale =
      height / Math.max(interaction.height, 1)

    properties.fontSize = Math.max(
      8,
      Math.round(interaction.fontSize * scale),
    )
  }

  onUpdateSource(
    interaction.sourceId,
    properties,
  )
}

    forceUpdate(
      (value) => value + 1,
    )
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
    <div className="preview-stage">

      <canvas
  ref={streamCanvasRef}
  data-stream-preview
  width={canvasWidth}
  height={canvasHeight}
  style={{ display: 'none' }}
/>
      
      <div
        ref={canvasRef}
        className={`canvas-content ${
          !enabled ? 'canvas-content-disabled' : ''
        }`}
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
  enabled ? (
    <div className="empty-canvas">
      <ImageIcon size={32} />
      <span>No visible sources</span>
    </div>
  ) : null
) : (
  visibleSources.map((source, index) => {
    const bounds = getSourceBounds(source)

    const left = (bounds.x / CANVAS_WIDTH) * 100
    const top = (bounds.y / CANVAS_HEIGHT) * 100
    const width = (bounds.width / CANVAS_WIDTH) * 100
    const height = (bounds.height / CANVAS_HEIGHT) * 100

    const isSelected = selectedSource === source.id

    return (
      <div
        key={source.id}
        className={`canvas-layer ${
          isSelected ? 'selected' : ''
        } ${!enabled ? 'preview-source-hidden' : ''}`}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          zIndex: index + 1,
        }}
        onPointerDown={(event) => {
          if (enabled) {
            beginDrag(event, source)
          }
        }}
      >
        <div className="source-render">
          {renderSource(
            source,
            volume,
            muted,
            monitoringMode,
          )}
        </div>

        {enabled && isSelected && !source.locked && (
          <>
            <div
              className="resize-handle resize-nw"
              role="presentation"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                beginResize(event, source, 'nw')
              }}
            />

            <div
              className="resize-handle resize-ne"
              role="presentation"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                beginResize(event, source, 'ne')
              }}
            />

            <div
              className="resize-handle resize-sw"
              role="presentation"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                beginResize(event, source, 'sw')
              }}
            />

            <div
              className="resize-handle resize-se"
              role="presentation"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                beginResize(event, source, 'se')
              }}
            />
          </>
        )}
      </div>
    )
  })
)}

{!enabled && (
  <div className="preview-disabled-content">
    <span>Preview disabled</span>
  </div>
)}
      </div>

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
