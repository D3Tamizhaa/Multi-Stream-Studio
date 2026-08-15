import { useEffect, useState } from 'react'
import { AddPlatformModal } from './components/AddPlatformModal'
import { AddSceneModal } from './components/AddSceneModal'
import { AddSourceModal } from './components/AddSourceModal'
import { AudioMixer } from './components/AudioMixer'
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
  Platform,
  Scene,
  SettingsSection,
  Source,
  StudioSettings,
} from './types/studio'

type Page = 'editor' | 'settings'

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

  const [settings, setSettings] =
    useState<StudioSettings>(defaultSettings)

  const [previewEnabled, setPreviewEnabled] =
    useState(true)

  const [audioVolume, setAudioVolume] =
    useState(80)

  const [audioMuted, setAudioMuted] =
    useState(false)

  const [streaming, setStreaming] =
    useState(false)

  const [uptime, setUptime] = useState(0)

  const [modal, setModal] = useState<
    | 'scene'
    | 'source'
    | 'platform'
    | 'source-properties'
    | 'platform-edit'
    | null
  >(null)

  useEffect(() => {
    if (!streaming) return

    const interval = window.setInterval(() => {
      setUptime((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [streaming])

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

    const index = scenes.findIndex((scene) => scene.id === activeScene)
    const next = scenes.filter((scene) => scene.id !== activeScene)

    setScenes(next)
    setActiveScene(next[Math.max(0, index - 1)].id)
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
      const exists = current.some((item) => item.id === source.id)

      return exists
        ? current.map((item) =>
            item.id === source.id ? source : item,
          )
        : [...current, source]
    })

    setSelectedSource(source.id)
    setModal(null)
  }

  function removeSource() {
    if (!selectedSource) return

    const next = sources.filter(
      (source) => source.id !== selectedSource,
    )

    setSources(next)
    setSelectedSource(next[0]?.id ?? null)
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
    if (platforms.length === 0) return

    setPlatforms((current) => current.slice(0, -1))
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
  sources={sources}
  enabled={previewEnabled}
  onToggle={() =>
    setPreviewEnabled((value) => !value)
  }
  selectedSource={selectedSource}
  onSelectSource={setSelectedSource}
  volume={audioVolume}
  muted={audioMuted}
/>

              </div>

              <div className="workspace-grid">
                <ScenesPanel
                  scenes={scenes}
                  activeScene={activeScene}
                  onSelect={setActiveScene}
                  onAdd={() => setModal('scene')}
                  onRemove={removeScene}
                  onMove={moveScene}
                />

                <SourcesPanel
                  sources={sources}
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
  onVolumeChange={setAudioVolume}
  onMuteToggle={() =>
    setAudioMuted((value) => !value)
  }
/>

              </div>

              <div className="stream-grid">
                <PlatformsPanel
                  platforms={platforms}
                  onAdd={() => setModal('platform')}
                  onRemove={removePlatform}
                  onToggle={togglePlatform}
                  onEdit={(platform) => {
                    setSelectedSource(platform.id)
                    setModal('platform-edit')
                  }}
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
              onSave={setSettings}
            />
          )}

          <UsageBar
            streaming={streaming}
            uptime={uptime}
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
    </div>
  )
}
