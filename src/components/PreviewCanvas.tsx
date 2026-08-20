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
  baseResolution: string
  outputResolution: string
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
  
function getSourceBounds(
  source: Source,
  canvasWidth: number,
  canvasHeight: number,
) {
  const width = source.properties.width ?? 640
  const height = source.properties.height ?? 360

  return {
    x:
      source.properties.x ??
      (canvasWidth - width) / 2,
    y:
      source.properties.y ??
      (canvasHeight - height) / 2,
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
  baseResolution,
  outputResolution,
  volume = 80,
  muted = false,
  monitoringMode = 'off',
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const streamCanvasRef = useRef<HTMLCanvasElement>(null)
  const interactionRef =
    useRef<Interaction>(null)

  const [, forceUpdate] = useState(0)

  const {
  width: canvasWidth,
  height: canvasHeight,
} = parseResolution(baseResolution)

const {
  width: outputWidth,
  height: outputHeight,
} = parseResolution(outputResolution)

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

  const visibleSources = sources.filter(
    (source) => source.visible,
  )

useEffect(() => {
  const canvas =
    streamCanvasRef.current

  if (!canvas) {
    return
  }

  const ctx =
    canvas.getContext('2d', {
      willReadFrequently: true,
    })

  if (!ctx) {
    return
  }

  let animationFrame = 0

  const drawText = (
    source: Source,
    x: number,
    y: number,
    width: number,
  ) => {
    const fontSize =
  (source.properties.fontSize ?? 32) * scaleY

    const fontFamily =
      source.properties.fontFamily ||
      'Inter, sans-serif'

    ctx.font =
      `${fontSize}px ${fontFamily}`

    ctx.fillStyle =
      source.properties.color ||
      '#ffffff'

    ctx.textBaseline = 'top'

    const text =
      source.properties.text ||
      source.name

    const words =
      text.split(/\s+/)

    const lines: string[] = []

    let currentLine = ''

    for (const word of words) {
      const testLine =
        currentLine
          ? `${currentLine} ${word}`
          : word

      if (
        ctx.measureText(
          testLine,
        ).width > width &&
        currentLine
      ) {
        lines.push(
          currentLine,
        )

        currentLine = word
      } else {
        currentLine =
          testLine
      }
    }

    if (currentLine) {
      lines.push(
        currentLine,
      )
    }

    const lineHeight =
      fontSize * 1.2

    lines.forEach(
      (line, index) => {
ctx.fillText(
  line,
  x * scaleX,
  y * scaleY +
    index * lineHeight,
)
      },
    )
  }

  const drawFrame = () => {

    const scaleX = outputWidth / canvasWidth
    const scaleY = outputHeight / canvasHeight
    /*
     * Clear Program Output.
     */
    ctx.fillStyle =
      '#000000'

    ctx.fillRect(
      0,
      0,
  outputWidth,
  outputHeight,
    )

    const previewRoot =
      canvasRef.current

    if (previewRoot) {
      for (
        const source of visibleSources
      ) {
        const bounds =
          getSourceBounds(
            source,
          )

        const {
          x,
          y,
          width,
          height,
        } = bounds

        /*
         * TEXT
         */
        if (
          source.type ===
          'text'
        ) {
          drawText(
            source,
            x,
            y,
            width,
          )

          continue
        }

        const layer =
          previewRoot.querySelector<HTMLElement>(
            `.canvas-layer[data-source-id="${CSS.escape(
              source.id,
            )}"]`,
          )

        if (!layer) {
          continue
        }

        /*
         * VIDEO / MEDIA
         */
        const video =
          layer.querySelector<HTMLVideoElement>(
            'video',
          )

        if (
          video &&
          video.readyState >=
            HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          try {
ctx.drawImage(
  video,
  x * scaleX,
  y * scaleY,
  width * scaleX,
  height * scaleY,
)
          } catch (
            error
          ) {
            console.warn(
              '[Program Output] Video draw failed:',
              source.name,
              error,
            )
          }

          continue
        }

        /*
         * IMAGE
         */
        const image =
          layer.querySelector<HTMLImageElement>(
            'img',
          )

        if (
          image &&
          image.complete &&
          image.naturalWidth > 0
        ) {
          try {
ctx.drawImage(
  image,
  x * scaleX,
  y * scaleY,
  width * scaleX,
  height * scaleY,
)
          } catch (
            error
          ) {
            console.warn(
              '[Program Output] Image draw failed:',
              source.name,
              error,
            )
          }
        }

        /*
         * Browser iframe sources cannot be
         * copied into a canvas when cross-origin.
         * They will require a future native browser
         * capture source if you want their pixels
         * included in Program Output.
         */
      }
    }

    animationFrame =
      requestAnimationFrame(
        drawFrame,
      )
  }

  drawFrame()

  return () => {
    cancelAnimationFrame(
      animationFrame,
    )
  }
}, [
  visibleSources,
  sources,
  canvasWidth,
  canvasHeight,
  outputWidth,
  outputHeight,
])

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

  if (aspectRatio > 0) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      height = Math.max(minHeight, width / aspectRatio)
    } else {
      width = Math.max(minWidth, height * aspectRatio)
    }
  }

  let x = startX
  let y = startY

  if (handle === 'nw' || handle === 'sw') {
    x = startX + startWidth - width
  }

  if (handle === 'nw' || handle === 'ne') {
    y = startY + startHeight - height
  }

  if (x < 0) {
    width += x
    x = 0
  }

  if (y < 0) {
    height += y
    y = 0
  }

if (x + width > canvasWidth) {
  width = canvasWidth - x
}

if (y + height > canvasHeight) {
  height = canvasHeight - y
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
  data-program-output
  width={outputWidth}
  height={outputHeight}
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
        data-source-id={source.id}
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
