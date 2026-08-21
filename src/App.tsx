import { useEffect, useState } from 'react'
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
  PlatformName,
  Scene,
  SettingsSection,
  Source,
  StudioSettings,
} from './types/studio'

type Page = 'editor' | 'settings'

const SETTINGS_STORAGE_KEY = 'multi-stream-studio-settings'
const STUDIO_STORAGE_KEY = 'multi-stream-studio-editor'
const AUTH_STORAGE_KEY = 'multi-stream-studio-auth'
const AUTH_SESSION_KEY = 'multi-stream-studio-session'

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

interface AuthCredentials {
  username: string
  password: string
}

function loadAuthCredentials(): AuthCredentials {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY)

    if (saved) {
      const parsed = JSON.parse(saved)

      if (
        typeof parsed.username === 'string' &&
        typeof parsed.password === 'string'
      ) {
        return {
          username: parsed.username,
          password: parsed.password,
        }
      }
    }

    const savedSettings = localStorage.getItem(
      SETTINGS_STORAGE_KEY,
    )

    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      const username = parsed.authorization?.username ?? ''
      const password = parsed.authorization?.password ?? ''

      if (username || password) {
        return {
          username,
          password,
        }
      }
    }
  } catch (error) {
    console.error(
      'Failed to load authentication credentials:',
      error,
    )
  }

  return {
    username: '',
    password: '',
  }
}

function saveAuthCredentials(credentials: AuthCredentials) {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(credentials),
  )
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
  
const [authCredentials, setAuthCredentials] =
  useState<AuthCredentials>(() => loadAuthCredentials())

const [loggedIn, setLoggedIn] = useState(() => {
  return localStorage.getItem(AUTH_SESSION_KEY) === 'true'
})

const [username, setUsername] = useState(() => {
  const credentials = loadAuthCredentials()
  return credentials.username || 'User'
})

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

  const [settingsDraft, setSettingsDraft] =
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
  
  const [modal, setModal] = useState<
    | 'scene'
    | 'source'
    | 'source-properties'
    | 'audio-properties'
    | null
  >(null)
  
function login(
  name: string,
  password: string,
): boolean {
  const stored = loadAuthCredentials()

  /*
   * First-time setup:
   * If no credentials have ever been configured,
   * use the first successful login as the initial account.
   */
  if (!stored.username && !stored.password) {
    const initialCredentials = {
      username: name,
      password,
    }

    saveAuthCredentials(initialCredentials)

    setAuthCredentials(initialCredentials)
    setUsername(name)
    setLoggedIn(true)

    localStorage.setItem(
      AUTH_SESSION_KEY,
      'true',
    )

    setSettings((current) => ({
      ...current,
      authorization: initialCredentials,
    }))

    setSettingsDraft((current) => ({
      ...current,
      authorization: initialCredentials,
    }))

    return true
  }

  if (
    name !== stored.username ||
    password !== stored.password
  ) {
    return false
  }

  setAuthCredentials(stored)
  setUsername(stored.username)
  setLoggedIn(true)

  localStorage.setItem(
    AUTH_SESSION_KEY,
    'true',
  )

  return true
}
  
function logout() {
  localStorage.removeItem(AUTH_SESSION_KEY)

  setLoggedIn(false)
  setPage('editor')
  setSettingsSection('Authorization')
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

setSettingsDraft((current) => ({
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
  

  if (!loggedIn) {
    return <LoginScreen onLogin={login} />
  }

  return (
    <div className="app-shell">
<Header
  collapsed={collapsed}
  username={username}
  onMenu={() => setCollapsed((value) => !value)}
  onLogout={logout}
/>

      <div className="app-body">
<Navigation
  collapsed={collapsed}
  page={page}
  settingsSection={settingsSection}
  onPageChange={(nextPage) => {
    if (nextPage === 'settings') {
      setSettingsDraft(settings)
    }

    setPage(nextPage)
  }}
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
  baseResolution={settings.video.baseResolution}
  outputResolution={settings.video.outputResolution}
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

  setSettingsDraft((current) => ({
    ...current,
    stream: {
      ...current.stream,
      service: 'YouTube',
      customServiceName: '',
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

                <ControlsPanel />
              </div>
            </>
          ) : (
<SettingsPanel
  section={settingsSection}
  settings={settingsDraft}
  onApply={(nextSettings) => {
    setSettings(nextSettings)
    setSettingsDraft(nextSettings)

    if (settingsSection === 'Authorization') {
  const nextCredentials = {
    username: nextSettings.authorization.username.trim(),
    password: nextSettings.authorization.password,
  }

  if (!nextCredentials.username) {
    return
  }

  saveAuthCredentials(nextCredentials)

  setAuthCredentials(nextCredentials)
  setUsername(nextCredentials.username)

  localStorage.setItem(
    AUTH_SESSION_KEY,
    'true',
  )
}

    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(nextSettings),
      )
    } catch (error) {
      console.error(
        'Failed to save settings:',
        error,
      )
    }

if (settingsSection === 'Stream') {
  const stream = nextSettings.stream

  const platformName: PlatformName =
    stream.service === 'Custom'
      ? 'Custom'
      : stream.service

  setPlatforms((current) => {
    // Existing platform edit
    if (selectedPlatform) {
      return current.map((platform): Platform =>
        platform.id === selectedPlatform
          ? {
              ...platform,
              name: platformName,
              server: stream.server,
              streamKey: stream.streamKey,
            }
          : platform,
      )
    }

    // New platform
    const newPlatform: Platform = {
      id: `platform-${Date.now()}`,
      name: platformName,
      enabled: true,
      server: stream.server,
      streamKey: stream.streamKey,
    }

    setSelectedPlatform(newPlatform.id)

    return [...current, newPlatform]
  })
}

    // Apply = commit everything + return to editor
    setPage('editor')
  }}
  onCancel={() => {
    // Throw away entire settings session
    setSettingsDraft(settings)

    // Return to editor without changing saved settings
    setPage('editor')
  }}
/>
          )}

          <UsageBar />

        </div>
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
