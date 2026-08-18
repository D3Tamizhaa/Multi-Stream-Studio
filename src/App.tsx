import { useEffect, useState } from 'react'
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

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [username, setUsername] = useState('User')

  const [collapsed, setCollapsed] = useState(false)
  const [page, setPage] = useState<Page>('editor')
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>('Authorization')

  const [scenes, setScenes] = useState<Scene[]>(defaultScenes)
  const [activeScene, setActiveScene] = useState(defaultScenes[0].id)

  const [sources, setSources] = useState<Source[]>(defaultSources)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  const [platforms, setPlatforms] =
    useState<Platform[]>(defaultPlatforms)

const [selectedPlatform, setSelectedPlatform] =
  useState<string | null>(null)
  
  const [settings, setSettings] =
  useState<StudioSettings>(() => loadSavedSettings())

  useEffect(() => {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    )
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}, [settings])
  
  const [previewEnabled, setPreviewEnabled] =
    useState(true)

  const [audioVolume, setAudioVolume] =
    useState(80)

  const [audioMuted, setAudioMuted] =
    useState(false)
  const [audioMonitoringMode, setAudioMonitoringMode] =
    useState<AudioMonitoringMode>('off')
  
  const [streaming, setStreaming] =
    useState(false)

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

  setSettings((current) => ({
    ...current,
    stream: {
      ...current.stream,
      service: platform.name,
      server: platform.server,
      streamKey: platform.streamKey,
    },
  }))

  setPage('settings')
  setSettingsSection('Stream')
}
  
  function startStreaming() {
    setStreaming(true)
    setUptime(0)
  }

  function stopStreaming() {
    setStreaming(false)
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
                                  ? (stream.customServiceName.trim() || 'Custom')
                                  : stream.service,
                              server: stream.server,
                              streamKey: stream.streamKey,
                            }
                          : platform,
                      )
                    }

                    // Adding a new platform
                    const newPlatform: Platform = {
                      id: `platform-${Date.now()}`,
                      name: 
                        stream.service === 'Custom'
                        ? (stream.customServiceName.trim() || 'Custom')
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
