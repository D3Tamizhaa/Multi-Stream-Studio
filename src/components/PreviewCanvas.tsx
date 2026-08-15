import {
  Globe,
  Image as ImageIcon,
  Lock,
  Music2,
  Type,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Source } from '../types/studio'

interface PreviewCanvasProps {
  sources: Source[]
  enabled: boolean
  onToggle: () => void
  selectedSource: string | null
  onSelectSource: (id: string) => void
  volume?: number
  muted?: boolean
}

function sourceIcon(type: Source['type']) {
  if (type === 'image') return <ImageIcon size={18} />
  if (type === 'browser') return <Globe size={18} />
  if (type === 'media') return <Music2 size={18} />
  return <Type size={18} />
}

function getSourceUrl(source: Source) {
  const file = source.properties.file?.trim()

  if (!file) return ''

  // Browser-safe URLs must NOT receive a leading slash.
  if (
    file.startsWith('blob:') ||
    file.startsWith('data:') ||
    file.startsWith('http://') ||
    file.startsWith('https://') ||
    file.startsWith('/')
  ) {
    return file
  }

  // Public assets can still be referenced by filename.
  return `/${file}`
}

export function PreviewCanvas({
  sources,
  enabled,
  onToggle,
  selectedSource,
  onSelectSource,
  volume = 80,
  muted = false,
}: PreviewCanvasProps) {
  const videoRefs = useRef<
    Record<string, HTMLVideoElement | null>
  >({})

  const visibleSources = sources.filter(
    (source) => source.visible,
  )

  useEffect(() => {
    Object.values(videoRefs.current).forEach((video) => {
      if (!video) return

      video.volume = Math.max(
        0,
        Math.min(1, volume / 100),
      )

      video.muted = muted

      // Autoplay is intentionally attempted after the source
      // has been rendered. If the browser rejects it, the user
      // can click the preview to start playback.
      void video.play().catch(() => {
        // Expected when browser autoplay policy blocks playback.
      })
    })
  }, [sources, volume, muted])

  function renderSource(source: Source) {
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
              event.currentTarget.style.display = 'none'
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
            ref={(element) => {
              videoRefs.current[source.id] = element

              if (element) {
                element.volume = Math.max(
                  0,
                  Math.min(1, volume / 100),
                )

                // Start muted so browser autoplay policies
                // don't prevent the preview from playing.
                element.muted = true
              }
            }}
            className="preview-media preview-video"
            src={url}
            autoPlay
            muted
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

              video.muted = true

              void video.play().catch(() => {
                // User can click the preview if autoplay is blocked.
              })
            }}
            onError={() => {
              console.error(
                `Unable to load media source: ${url}`,
              )
            }}
          />
        ) : (
          <div className="preview-placeholder">
            <Music2 size={28} />
            <span>No media file selected</span>
          </div>
        )

      case 'browser':
        return source.properties.url ? (
          <iframe
            src={source.properties.url}
            title={source.name}
            className="preview-browser"
            width={source.properties.width || 640}
            height={source.properties.height || 360}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="preview-placeholder">
            <Globe size={28} />
            <span>No browser URL configured</span>
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

  function handleLayerClick(
    source: Source,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    onSelectSource(source.id)

    if (source.type !== 'media') return

    const video =
      event.currentTarget.querySelector<HTMLVideoElement>(
        'video',
      )

    if (!video) return

    // A click is a user gesture, so we can now request
    // playback with the user's selected audio state.
    video.muted = muted
    video.volume = Math.max(
      0,
      Math.min(1, volume / 100),
    )

    void video.play().catch((error) => {
      console.error('Unable to start media playback:', error)
    })
  }

  return (
    <section className="preview-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EDITOR</span>
          <h2>Canvas Preview</h2>
        </div>

        <label className="toggle-line">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
          />

          <span>Preview</span>
        </label>
      </div>

      <div
        className={`preview-stage ${
          !enabled ? 'preview-disabled' : ''
        }`}
      >
        <div className="canvas-grid" />

        {enabled ? (
          <div className="canvas-content">
            {visibleSources.length === 0 ? (
              <div className="empty-canvas">
                <ImageIcon size={32} />
                <span>No visible sources</span>
              </div>
            ) : (
              visibleSources.map((source, index) => (
                <button
                  type="button"
                  key={source.id}
                  className={`canvas-layer layer-${index} ${
                    selectedSource === source.id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={(event) =>
                    handleLayerClick(source, event)
                  }
                  style={{
                    zIndex: index + 1,
                  }}
                >
                  <div className="source-render">
                    {renderSource(source)}
                  </div>

                  <div className="layer-toolbar">
                    <span className="layer-icon">
                      {sourceIcon(source.type)}
                    </span>

                    <span className="layer-label">
                      {source.type === 'text'
                        ? source.properties.text ||
                          source.name
                        : source.name}
                    </span>

                    {source.locked && (
                      <Lock
                        size={12}
                        className="layer-lock"
                      />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="preview-off">
            <span>Preview disabled</span>
          </div>
        )}

        <div className="canvas-resolution">
          1920 × 1080
        </div>
      </div>
    </section>
  )
}
