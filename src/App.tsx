import { useEffect, useRef, useState } from 'react'
import { AddPlatformModal } from './components/AddPlatformModal'
import { AddSceneModal } from './components/AddSceneModal'
import { AddSourceModal } from './components/AddSourceModal'
import { AudioMixer } from './components/AudioMixer'
import { AudioPropertiesModal } from './components/AudioPropertiesModal'
import { ControlsPanel } from './components/ControlsPanel'
import { Header } from './components/Header'
import { LoginScreen } from './components/LoginScreen'
import { Navigation } from './components/Navigation'
import { PlatformsPanel } from './components/PlatformsPanel'
import { PreviewCanvas } from './components/PreviewCanvas'
import { ScenesPanel } from './components/ScenesPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { SourcesPanel } from './components/SourcesPanel'
import { UsageBar } from './components/UsageBar'
import {
  defaultPlatforms,
  defaultScenes,
  defaultSettings,
  defaultSources,
} from './data/defaults'
import { startAudioBridge } from './streaming/audio-bridge'
import type {
  AudioMonitoringMode,
  Platform,
  Scene,
  SettingsSection,
  Source,
  StudioSettings,
} from './types/studio'

type Page = 'editor' | 'settings'

const SETTINGS_STORAGE_KEY = 'multi-stream-studio-settings'
const STUDIO_STORAGE_KEY = 'multi-stream-studio-editor'

interface SavedStudioState {
  scenes: Scene[]
  activeScene: string
  sources: Source[]
  platforms: Platform[]
  selectedPlatform: string | null
  audioVolume: number
  audioMuted: boolean
  audioMonitoringMode: AudioMonitoringMode
}

const defaultStudioState: SavedStudioState = {
  scenes: defaultScenes,
  activeScene: defaultScenes[0]?.id ?? '',
  sources: defaultSources,
  platforms: defaultPlatforms,
  selectedPlatform: null,
  audioVolume: 80,
  audioMuted: false,
  audioMonitoringMode: 'off',
}

function loadSavedSettings(): StudioSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)

    if (!saved) {
      return defaultSettings
    }

    const parsed = JSON.parse(saved)

    return {
      ...defaultSettings,
      ...parsed,
      authorization: {
        ...defaultSettings.authorization,
        ...parsed.authorization,
      },
      stream: {
        ...defaultSettings.stream,
        ...parsed.stream,
        customServiceName:
          parsed.stream?.customServiceName ?? '',
      },
      output: {
        ...defaultSettings.output,
        ...parsed.output,
      },
      audio: {
        ...defaultSettings.audio,
        ...parsed.audio,
      },
      video: {
        ...defaultSettings.video,
        ...parsed.video,
      },
      advanced: {
        ...defaultSettings.advanced,
        ...parsed.advanced,
      },
    }
  } catch (error) {
    console.error('Failed to load saved settings:', error)
    return defaultSettings
  }
}


function loadSavedStudioState(): SavedStudioState {
  try {
    const saved = localStorage.getItem(STUDIO_STORAGE_KEY)

    if (!saved) {
      return defaultStudioState
    }

    const parsed = JSON.parse(saved)

    const loadedScenes =
      Array.isArray(parsed.scenes) && parsed.scenes.length > 0
        ? parsed.scenes
        : defaultScenes

    return {
      ...defaultStudioState,
      ...parsed,
      scenes: loadedScenes,
      activeScene: loadedScenes.some(
        (scene: Scene) => scene.id === parsed.activeScene,
      )
        ? parsed.activeScene
        : loadedScenes[0]?.id ?? '',
      sources: Array.isArray(parsed.sources)
        ? parsed.sources
        : defaultSources,
      platforms: Array.isArray(parsed.platforms)
        ? parsed.platforms
        : defaultPlatforms,
      audioVolume:
        typeof parsed.audioVolume === 'number'
          ? Math.max(0, Math.min(100, parsed.audioVolume))
          : 80,
      audioMuted:
        typeof parsed.audioMuted === 'boolean'
          ? parsed.audioMuted
          : false,
      audioMonitoringMode:
        parsed.audioMonitoringMode === 'monitor-only' ||
        parsed.audioMonitoringMode === 'monitor-and-output'
          ? parsed.audioMonitoringMode
          : 'off',
    }
  } catch (error) {
    console.error('Failed to load saved studio state:', error)
    return defaultStudioState
  }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [username, setUsername] = useState('User')

  const [collapsed, setCollapsed] = useState(false)
  const [page, setPage] = useState<Page>('editor')
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>('Authorization')

const [savedStudioState] = useState<SavedStudioState>(() =>
  loadSavedStudioState(),
)

const [scenes, setScenes] = useState<Scene[]>(
  savedStudioState.scenes,
)

const [activeScene, setActiveScene] = useState(
  savedStudioState.activeScene,
)

const [sources, setSources] = useState<Source[]>(
  savedStudioState.sources,
)

const [selectedSource, setSelectedSource] =
  useState<string | null>(null)

const [platforms, setPlatforms] = useState<Platform[]>(
  savedStudioState.platforms,
)

const [selectedPlatform, setSelectedPlatform] =
  useState<string | null>(
    savedStudioState.selectedPlatform,
  )
  
  const [settings, setSettings] =
  useState<StudioSettings>(() => loadSavedSettings())
  
  const [previewEnabled, setPreviewEnabled] =
    useState(true)

const [audioVolume, setAudioVolume] = useState(
  savedStudioState.audioVolume,
)

const [audioMuted, setAudioMuted] = useState(
  savedStudioState.audioMuted,
)

const [audioMonitoringMode, setAudioMonitoringMode] =
  useState<AudioMonitoringMode>(
    savedStudioState.audioMonitoringMode,
  )

  useEffect(() => {
  try {
    const studioState: SavedStudioState = {
      scenes,
      activeScene,
      sources,
      platforms,
      selectedPlatform,
      audioVolume,
      audioMuted,
      audioMonitoringMode,
    }

    localStorage.setItem(
      STUDIO_STORAGE_KEY,
      JSON.stringify(studioState),
    )
  } catch (error) {
    console.error(
      'Failed to save studio state:',
      error,
    )
  }
}, [
  scenes,
  activeScene,
  sources,
  platforms,
  selectedPlatform,
  audioVolume,
  audioMuted,
  audioMonitoringMode,
])
  
const [streaming, setStreaming] =
  useState(false)

const streamSessionRef =
  useRef<string | null>(null)

const streamFrameTimerRef =
  useRef<number | null>(null)

const streamFrameBusyRef =
  useRef(false)

const streamAudioRef =
  useRef<{
    stop: () => void
  } | null>(null)

  const [uptime, setUptime] = useState(0)
  const [cpu, setCpu] = useState(0)
  const [ram, setRam] = useState(0)

  const [modal, setModal] = useState<
    | 'scene'
    | 'source'
    | 'platform'
    | 'source-properties'
    | 'platform-edit'
    | 'audio-properties'
    | null
  >(null)

  useEffect(() => {
    if (!streaming) return

    const interval = window.setInterval(() => {
      setUptime((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [streaming])

  useEffect(() => {
  let cancelled = false

  async function updateSystemStats() {
    try {
      const response = await fetch(
  '/api/system-stats',
  {
    cache: 'no-store',
  },
)

      if (!response.ok) {
        throw new Error('Failed to read system stats')
      }

      const data = await response.json()

      console.log('SYSTEM STATS RECEIVED:', data)

      if (!cancelled) {
        setCpu(Number(data.cpu) || 0)
        setRam(Number(data.ram) || 0)
      }
    } catch (error) {
      console.error('SYSTEM STATS FETCH FAILED:', error)
    }
  }

  updateSystemStats()

  const interval = window.setInterval(
    updateSystemStats,
    1000,
  )

  return () => {
    cancelled = true
    window.clearInterval(interval)
  }
}, [])
  
  function login(name: string) {
    setUsername(name)
    setLoggedIn(true)
  }

  function addScene(name: string) {
    const scene: Scene = {
      id: `scene-${Date.now()}`,
      name,
    }

    setScenes((current) => [...current, scene])
    setActiveScene(scene.id)
    setModal(null)
  }

function removeScene() {
  if (scenes.length <= 1) return

  const index = scenes.findIndex(
    (scene) => scene.id === activeScene,
  )

  const nextScenes = scenes.filter(
    (scene) => scene.id !== activeScene,
  )

  setSources((current) =>
    current.filter(
      (source) => source.sceneId !== activeScene,
    ),
  )

  setSelectedSource(null)

  const nextActiveScene =
    nextScenes[Math.max(0, index - 1)]

  setScenes(nextScenes)
  setActiveScene(nextActiveScene.id)
}

  function moveScene(direction: 'up' | 'down') {
    const index = scenes.findIndex((scene) => scene.id === activeScene)
    const target = direction === 'up' ? index - 1 : index + 1

    if (target < 0 || target >= scenes.length) return

    const next = [...scenes]
    ;[next[index], next[target]] = [next[target], next[index]]

    setScenes(next)
  }

  function addOrUpdateSource(source: Source) {
  setSources((current) => {
    const existing = current.find(
      (item) => item.id === source.id,
    )

    const sourceWithScene: Source = {
      ...source,
      sceneId: existing?.sceneId ?? activeScene,
    }

    return existing
      ? current.map((item) =>
          item.id === source.id ? sourceWithScene : item,
        )
      : [...current, sourceWithScene]
  })

  setSelectedSource(source.id)
  setModal(null)
}

  function updateSource(
  id: string,
  properties: Partial<Source['properties']>,
) {
  setSources((current) =>
    current.map((source) =>
      source.id === id
        ? {
            ...source,
            properties: {
              ...source.properties,
              ...properties,
            },
          }
        : source,
    ),
  )
}

function removeSource() {
  if (!selectedSource) return

  const next = sources.filter(
    (source) => source.id !== selectedSource,
  )

  setSources(next)

  const remainingSources = next.filter(
    (source) => source.sceneId === activeScene,
  )

  setSelectedSource(
    remainingSources[0]?.id ?? null,
  )
}

  function toggleSourceVisibility(id: string) {
    setSources((current) =>
      current.map((source) =>
        source.id === id
          ? { ...source, visible: !source.visible }
          : source,
      ),
    )
  }

  function toggleSourceLock(id: string) {
    setSources((current) =>
      current.map((source) =>
        source.id === id
          ? { ...source, locked: !source.locked }
          : source,
      ),
    )
  }

  function moveSource(direction: 'up' | 'down') {
    if (!selectedSource) return

    const index = sources.findIndex(
      (source) => source.id === selectedSource,
    )

    const target = direction === 'up' ? index - 1 : index + 1

    if (target < 0 || target >= sources.length) return

    const next = [...sources]
    ;[next[index], next[target]] = [next[target], next[index]]

    setSources(next)
  }

  function addOrUpdatePlatform(platform: Platform) {
    setPlatforms((current) => {
      const exists = current.some(
        (item) => item.id === platform.id,
      )

      return exists
        ? current.map((item) =>
            item.id === platform.id ? platform : item,
          )
        : [...current, platform]
    })

    setModal(null)
  }

function removePlatform() {
  if (!selectedPlatform) return

  setPlatforms((current) =>
    current.filter(
      (platform) => platform.id !== selectedPlatform,
    ),
  )

  setSelectedPlatform(null)
}

  function togglePlatform(id: string) {
    setPlatforms((current) =>
      current.map((platform) =>
        platform.id === id
          ? { ...platform, enabled: !platform.enabled }
          : platform,
      ),
    )
  }

  function selectPlatform(id: string) {
  setSelectedPlatform(id)
}

function editPlatform(platform: Platform) {
  setSelectedPlatform(platform.id)

  const service =
    platform.name === 'YouTube' ||
    platform.name === 'Facebook' ||
    platform.name === 'Twitch' ||
    platform.name === 'Kick'
      ? platform.name
      : 'Custom'

  setSettings((current) => ({
    ...current,
    stream: {
      ...current.stream,
      service,
      customServiceName:
        service === 'Custom' ? platform.name : '',
      server: platform.server,
      streamKey: platform.streamKey,
    },
  }))

  setPage('settings')
  setSettingsSection('Stream')
}
  
async function startStreaming() {
  if (streaming) {
    return
  }

if (
  !window.electronStream?.isAvailable
) {
  console.error(
    '[MSS] electronStream bridge is unavailable.',
  )

  window.alert(
    'Multi-Stream Studio is running in a normal browser window.\n\nClose this page and start the application with:\n\nnpm run dev\n\nThen use the Electron window that opens.',
  )

  return
}

  const enabledPlatforms =
    platforms.filter(
      (platform) =>
        platform.enabled &&
        platform.server.trim() &&
        platform.streamKey.trim(),
    )

  if (
    enabledPlatforms.length === 0
  ) {
    window.alert(
      'Enable at least one platform with a server and stream key.',
    )

    return
  }

  const programCanvas =
    document.querySelector<HTMLCanvasElement>(
      'canvas[data-program-output]',
    )

  if (!programCanvas) {
    window.alert(
      'Program output canvas was not found.',
    )

    return
  }

  try {
    console.log(
      '[Stream] Starting native FFmpeg engine...',
    )

    const result =
      await window.electronStream.start({
        platforms:
          enabledPlatforms,

        output:
          settings.output,

        audio:
          settings.audio,

        video:
          settings.video,

        advanced:
          settings.advanced,
      })

    streamSessionRef.current =
      result.sessionId

    /*
     * Start the real program audio mixer.
     */
    streamAudioRef.current =
      await startAudioBridge({
        volume: audioVolume,
        muted: audioMuted,
        monitoringMode:
          audioMonitoringMode,
        sessionId:
          result.sessionId,
      })

    /*
     * Send the FINAL PROGRAM CANVAS to
     * native FFmpeg as raw RGBA frames.
     *
     * No MediaRecorder.
     * No WebM.
     * No HTTP upload.
     */
    const fps =
      Math.max(
        1,
        Number.parseInt(
          settings.video.fps,
          10,
        ) || 30,
      )

    const frameInterval =
      1000 / fps

    const sendFrame =
      () => {
        if (
          !streamSessionRef.current ||
          !programCanvas
        ) {
          return
        }

        /*
         * Never queue multiple huge 1920x1080
         * frames. If FFmpeg is busy, drop this
         * frame and use the next one.
         */
        if (
          streamFrameBusyRef.current
        ) {
          streamFrameTimerRef.current =
            window.setTimeout(
              sendFrame,
              frameInterval,
            )

          return
        }

        const ctx =
          programCanvas.getContext(
            '2d',
          )

        if (!ctx) {
          return
        }

        try {
          const image =
            ctx.getImageData(
              0,
              0,
              programCanvas.width,
              programCanvas.height,
            )

          const buffer =
            image.data.buffer

          streamFrameBusyRef.current =
            true

          const targetOrigin =
            window.location.protocol ===
            'file:'
              ? '*'
              : window.location.origin

          window.postMessage(
            {
              __mssStream: true,
              sessionId:
                streamSessionRef.current,
              type: 'video',
              buffer,
            },
            targetOrigin,
            [buffer],
          )
        } catch (error) {
          console.error(
            '[Stream] Program frame capture failed:',
            error,
          )
        }

        streamFrameTimerRef.current =
          window.setTimeout(
            sendFrame,
            frameInterval,
          )
      }

    const handleAck =
      (
        event: Event,
      ) => {
        const customEvent =
          event as CustomEvent<{
            kind?: string
          }>

        if (
          customEvent.detail?.kind ===
          'video'
        ) {
          streamFrameBusyRef.current =
            false
        }
      }

    window.addEventListener(
      'mss-stream-ack',
      handleAck,
    )

    /*
     * Store cleanup on the window so
     * stopStreaming can remove the listener.
     */
    ;(
      window as Window & {
        __mssStreamCleanup?: () => void
      }
    ).__mssStreamCleanup =
      () => {
        window.removeEventListener(
          'mss-stream-ack',
          handleAck,
        )
      }

    streamFrameBusyRef.current =
      false

    setStreaming(true)
    setUptime(0)

    sendFrame()

    console.log(
      '[Stream] Native FFmpeg streaming started.',
    )
  } catch (error) {
    console.error(
      '[Stream] START ERROR:',
      error,
    )

    streamAudioRef.current?.stop()
    streamAudioRef.current =
      null

    if (
      window.electronStream
    ) {
      try {
        await window.electronStream.stop()
      } catch {}
    }

    streamSessionRef.current =
      null

    setStreaming(false)

    window.alert(
      `Unable to start streaming:\n\n${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    )
  }
}

async function stopStreaming() {
  console.log(
    '[Stream] Stopping native stream...',
  )

  if (
    streamFrameTimerRef.current !==
    null
  ) {
    window.clearTimeout(
      streamFrameTimerRef.current,
    )

    streamFrameTimerRef.current =
      null
  }

  streamFrameBusyRef.current =
    false

  ;(
    window as Window & {
      __mssStreamCleanup?: () => void
    }
  ).__mssStreamCleanup?.()

  ;(
    window as Window & {
      __mssStreamCleanup?: () => void
    }
  ).__mssStreamCleanup =
    undefined

  streamAudioRef.current?.stop()

  streamAudioRef.current =
    null

  try {
    await window.electronStream?.stop()
  } catch (error) {
    console.error(
      '[Stream] Native stop failed:',
      error,
    )
  }

  streamSessionRef.current =
    null

  setStreaming(false)
  setUptime(0)

  console.log(
    '[Stream] Native stream stopped.',
  )
}

  if (!loggedIn) {
    return <LoginScreen onLogin={login} />
  }

  return (
    <div className="app-shell">
      <Header
        collapsed={collapsed}
        onMenu={() => setCollapsed((value) => !value)}
      />

      <div className="app-body">
        <Navigation
          collapsed={collapsed}
          page={page}
          settingsSection={settingsSection}
          onPageChange={setPage}
          onSettingsChange={setSettingsSection}
        />

        <div className="main-area">
          {page === 'editor' ? (
            <>
              <div className="editor-main">
  <PreviewCanvas
    sources={sources.filter(
      (source) => source.sceneId === activeScene,
    )}
    enabled={previewEnabled}
    onToggle={() =>
      setPreviewEnabled((value) => !value)
    }
    selectedSource={selectedSource}
    onSelectSource={setSelectedSource}
    onUpdateSource={updateSource}
    volume={audioVolume}
    muted={audioMuted}
    monitoringMode={audioMonitoringMode}
  />
</div>

              <div className="workspace-grid">
<ScenesPanel
  scenes={scenes}
  activeScene={activeScene}
  onSelect={(sceneId) => {
    setActiveScene(sceneId)

    setSelectedSource(
      sources.find(
        (source) => source.sceneId === sceneId,
      )?.id ?? null,
    )
  }}
  onAdd={() => setModal('scene')}
  onRemove={removeScene}
  onMove={moveScene}
/>

 <SourcesPanel
  sources={sources.filter(
    (source) => source.sceneId === activeScene,
  )}
  selectedSource={selectedSource}
  onSelect={setSelectedSource}
  onAdd={() => setModal('source')}
  onRemove={removeSource}
  onToggleVisibility={toggleSourceVisibility}
  onToggleLock={toggleSourceLock}
  onProperties={() =>
    selectedSource && setModal('source-properties')
  }
  onMove={moveSource}
/>

 <AudioMixer
  volume={audioVolume}
  muted={audioMuted}
  monitoringMode={audioMonitoringMode}
  onVolumeChange={setAudioVolume}
  onMuteToggle={() =>
    setAudioMuted((value) => !value)
  }
  onProperties={() =>
    setModal('audio-properties')
  }
/>

              </div>

              <div className="stream-grid">
                <PlatformsPanel
  platforms={platforms}
  selectedPlatform={selectedPlatform}
  onSelect={selectPlatform}
  onAdd={() => {
    setSelectedPlatform(null)

    setSettings((current) => ({
      ...current,
      stream: {
        ...current.stream,
        service: 'YouTube',
        server: '',
        streamKey: '',
      },
    }))

    setPage('settings')
    setSettingsSection('Stream')
  }}
  onRemove={removePlatform}
  onToggle={togglePlatform}
  onEdit={editPlatform}
/>

                <ControlsPanel
                  streaming={streaming}
                  onStart={startStreaming}
                  onStop={stopStreaming}
                />
              </div>
            </>
          ) : (
            <SettingsPanel
              section={settingsSection}
              settings={settings}
              onSave={(nextSettings) => {
                setSettings(nextSettings)

                if (settingsSection === 'Stream') {
                  const stream = nextSettings.stream

                  setPlatforms((current) => {
                    // Editing an existing platform
                    if (selectedPlatform) {
                      return current.map((platform) =>
                        platform.id === selectedPlatform
                          ? {
                              ...platform,
name:
  stream.service === 'Custom'
    ? 'Custom'
    : stream.service,
                              server: stream.server,
                              streamKey: stream.streamKey,
                            }
                          : platform,
                      )
                    }

const newPlatform: Platform = {
  id: `platform-${Date.now()}`,
  name:
    stream.service === 'Custom'
      ? 'Custom'
      : stream.service,
  enabled: true,
  server: stream.server,
  streamKey: stream.streamKey,
}

                    setSelectedPlatform(newPlatform.id)

                    return [...current, newPlatform]
                  })
                }

                setPage('editor')
              }}
            />
          )}

          <UsageBar
            streaming={streaming}
            uptime={uptime}
            cpu={cpu}
            ram={ram}
          />

        </div>
      </div>

      <div className="current-user" aria-hidden="true">
        {username}
      </div>

      {modal === 'scene' && (
        <AddSceneModal
          onClose={() => setModal(null)}
          onAdd={addScene}
        />
      )}

      {modal === 'source' && (
        <AddSourceModal
          onClose={() => setModal(null)}
          onAdd={addOrUpdateSource}
        />
      )}

      {modal === 'source-properties' && selectedSource && (
        <AddSourceModal
          existing={sources.find(
            (source) => source.id === selectedSource,
          )}
          onClose={() => setModal(null)}
          onAdd={addOrUpdateSource}
        />
      )}

      {modal === 'platform' && (
        <AddPlatformModal
          onClose={() => setModal(null)}
          onAdd={addOrUpdatePlatform}
        />
      )}

      {modal === 'platform-edit' && (
        <AddPlatformModal
          existing={platforms.find(
            (platform) => platform.id === selectedSource,
          )}
          onClose={() => setModal(null)}
          onAdd={addOrUpdatePlatform}
        />
      )}

      {modal === 'audio-properties' && (
  <AudioPropertiesModal
    monitoringMode={audioMonitoringMode}
    onMonitoringModeChange={
      setAudioMonitoringMode
    }
    onClose={() => setModal(null)}
  />
)}

    </div>
  )
}
