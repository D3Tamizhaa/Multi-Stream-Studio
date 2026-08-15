import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "multi-stream-studio-state-v1";

const defaultState = {
  loggedIn: false,
  username: "User",
  activePage: "editor",
  settingsPage: "authorization",
  canvasEnabled: true,

  scenes: [
    { id: "scene-1", name: "Scene 1" },
    { id: "scene-2", name: "Scene 2" }
  ],

  activeSceneId: "scene-1",

  sources: {
    "scene-1": [
      {
        id: "source-image",
        type: "image",
        name: "Image",
        visible: true,
        locked: false,
        x: 12,
        y: 12,
        width: 42,
        height: 42,
        color: "#2563eb"
      },
      {
        id: "source-browser",
        type: "browser",
        name: "Browser Source",
        visible: true,
        locked: false,
        x: 53,
        y: 18,
        width: 35,
        height: 30,
        url: "https://example.com"
      },
      {
        id: "source-text",
        type: "text",
        name: "Text",
        visible: true,
        locked: false,
        x: 25,
        y: 68,
        width: 50,
        height: 12,
        text: "My Text",
        fontFamily: "Arial",
        fontSize: 32,
        color: "#ffffff"
      }
    ],
    "scene-2": [
      {
        id: "source-media",
        type: "media",
        name: "Media File",
        visible: true,
        locked: false,
        x: 20,
        y: 20,
        width: 60,
        height: 60,
        loop: true
      }
    ]
  },

  selectedSourceId: "source-image",

  platforms: [
    {
      id: "youtube",
      name: "YouTube",
      enabled: true,
      server: "",
      streamKey: ""
    },
    {
      id: "twitch",
      name: "Twitch",
      enabled: false,
      server: "",
      streamKey: ""
    }
  ],

  mixer: {
    volume: 80,
    muted: false
  },

  settings: {
    authorization: {
      username: "",
      password: ""
    },
    stream: {
      service: "YouTube",
      server: "",
      streamKey: ""
    },
    output: {
      encoder: "H.264",
      rateControl: "CBR",
      bitrate: "6000",
      keyframe: "2",
      preset: "Quality",
      profile: "High",
      tune: "None"
    },
    audio: {
      encoder: "AAC",
      bitrate: "160",
      sampleRate: "48 kHz",
      channels: "Stereo"
    },
    video: {
      baseResolution: "1920x1080",
      outputResolution: "1920x1080",
      fps: "60"
    },
    advanced: {
      reconnect: true,
      network: "Default"
    }
  },

  streaming: false,
  startedAt: null
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved
      ? { ...defaultState, ...JSON.parse(saved) }
      : defaultState;
  } catch {
    return defaultState;
  }
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function App() {
  const [state, setState] = useState(loadState);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message) => setToast(message);

  const update = (patch) => {
    setState((current) => ({
      ...current,
      ...patch
    }));
  };

  const activeSources = state.sources[state.activeSceneId] || [];

  const activeSource = activeSources.find(
    (source) => source.id === state.selectedSourceId
  );

  const goEditor = () => {
    update({ activePage: "editor" });
    setMenuOpen(false);
  };

  const goSettings = (page) => {
    update({
      activePage: "settings",
      settingsPage: page
    });
    setMenuOpen(false);
  };

  const addScene = () => {
    setModal({
      type: "scene",
      title: "Add Scene"
    });
  };

  const confirmScene = (name) => {
    const scene = {
      id: uid("scene"),
      name: name || `Scene ${state.scenes.length + 1}`
    };

    update({
      scenes: [...state.scenes, scene],
      activeSceneId: scene.id,
      selectedSourceId: null,
      sources: {
        ...state.sources,
        [scene.id]: []
      }
    });

    setModal(null);
    notify("Scene added");
  };

  const removeScene = () => {
    if (state.scenes.length <= 1) {
      notify("At least one scene is required");
      return;
    }

    const index = state.scenes.findIndex(
      (scene) => scene.id === state.activeSceneId
    );

    const remaining = state.scenes.filter(
      (scene) => scene.id !== state.activeSceneId
    );

    const nextScene = remaining[Math.max(0, index - 1)];

    const sources = { ...state.sources };
    delete sources[state.activeSceneId];

    update({
      scenes: remaining,
      activeSceneId: nextScene.id,
      selectedSourceId: sources[nextScene.id]?.[0]?.id || null,
      sources
    });

    notify("Scene removed");
  };

  const moveScene = (direction) => {
    const index = state.scenes.findIndex(
      (scene) => scene.id === state.activeSceneId
    );

    const target = index + direction;

    if (target < 0 || target >= state.scenes.length) return;

    const scenes = [...state.scenes];
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];

    update({ scenes });
  };

  const addSource = (source) => {
    const sourceWithId = {
      ...source,
      id: uid("source"),
      visible: true,
      locked: false,
      x: 25,
      y: 25,
      width: 45,
      height: 30
    };

    const sources = {
      ...state.sources,
      [state.activeSceneId]: [
        ...(state.sources[state.activeSceneId] || []),
        sourceWithId
      ]
    };

    update({
      sources,
      selectedSourceId: sourceWithId.id
    });

    setModal(null);
    notify(`${source.name} added`);
  };

  const removeSource = () => {
    if (!activeSource) return;

    const sources = {
      ...state.sources,
      [state.activeSceneId]: activeSources.filter(
        (source) => source.id !== activeSource.id
      )
    };

    update({
      sources,
      selectedSourceId:
        sources[state.activeSceneId]?.[0]?.id || null
    });

    notify("Source removed");
  };

  const updateSource = (sourceId, patch) => {
    const sources = {
      ...state.sources,
      [state.activeSceneId]: activeSources.map((source) =>
        source.id === sourceId
          ? { ...source, ...patch }
          : source
      )
    };

    update({ sources });
  };

  const toggleSource = (source) => {
    updateSource(source.id, {
      visible: !source.visible
    });
  };

  const toggleLock = (source) => {
    updateSource(source.id, {
      locked: !source.locked
    });
  };

  const moveSource = (direction) => {
    if (!activeSource) return;

    const index = activeSources.findIndex(
      (source) => source.id === activeSource.id
    );

    const target = index + direction;

    if (target < 0 || target >= activeSources.length) return;

    const list = [...activeSources];
    [list[index], list[target]] = [list[target], list[index]];

    update({
      sources: {
        ...state.sources,
        [state.activeSceneId]: list
      }
    });
  };

  const toggleStreaming = () => {
    if (state.streaming) {
      update({
        streaming: false,
        startedAt: null
      });
      notify("Streaming ended");
    } else {
      const enabledPlatforms = state.platforms.filter(
        (platform) => platform.enabled
      );

      if (!enabledPlatforms.length) {
        notify("Enable at least one platform first");
        return;
      }

      update({
        streaming: true,
        startedAt: Date.now()
      });

      notify("Streaming started");
    }
  };

  if (!state.loggedIn) {
    return (
      <Login
        username={state.username}
        onLogin={(username) => {
          update({
            loggedIn: true,
            username: username || "User"
          });
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="icon-button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Navigation"
        >
          ☰
        </button>

        <div className="brand">
          <span className="brand-mark">M</span>
          <span>Multi Stream Studio</span>
        </div>

        <div className="topbar-spacer" />

        <div className="user-menu">
          <span className="status-dot" />
          {state.username}
          <span>▾</span>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
          <Sidebar
            state={state}
            goEditor={goEditor}
            goSettings={goSettings}
            mobile
          />
        </div>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <Sidebar
            state={state}
            goEditor={goEditor}
            goSettings={goSettings}
          />
        </aside>

        <main className="main-area">
          {state.activePage === "editor" ? (
            <Editor
              state={state}
              activeSources={activeSources}
              activeSource={activeSource}
              setModal={setModal}
              update={update}
              updateSource={updateSource}
              toggleSource={toggleSource}
              toggleLock={toggleLock}
              moveSource={moveSource}
              addScene={addScene}
              removeScene={removeScene}
              moveScene={moveScene}
              toggleStreaming={toggleStreaming}
              notify={notify}
            />
          ) : (
            <Settings
              state={state}
              update={update}
              notify={notify}
            />
          )}
        </main>
      </div>

      <div className="toast-container">
        {toast && <div className="toast">{toast}</div>}
      </div>

      {modal && (
        <Modal
          modal={modal}
          close={() => setModal(null)}
          onConfirm={confirmScene}
          addSource={addSource}
        />
      )}
    </div>
  );
}

function Sidebar({ state, goEditor, goSettings, mobile = false }) {
  return (
    <nav className={mobile ? "mobile-sidebar" : "sidebar-inner"}>
      <button
        className={`nav-item ${
          state.activePage === "editor" ? "active" : ""
        }`}
        onClick={goEditor}
      >
        <span>▣</span>
        Editor
      </button>

      <div className="nav-section-title">SETTINGS</div>

      {[
        ["authorization", "Authorization"],
        ["stream", "Stream"],
        ["output", "Output"],
        ["audio", "Audio"],
        ["video", "Video"],
        ["advanced", "Advanced"]
      ].map(([id, label]) => (
        <button
          key={id}
          className={`nav-item nested ${
            state.activePage === "settings" &&
            state.settingsPage === id
              ? "active"
              : ""
          }`}
          onClick={() => goSettings(id)}
        >
          {label}
        </button>
      ))}

      <div className="sidebar-bottom">
        <div className="connection-card">
          <span className="green-dot" />
          Local Studio
          <small>State saved locally</small>
        </div>
      </div>
    </nav>
  );
}

function Login({ username, onLogin }) {
  const [user, setUser] = useState(username === "User" ? "" : username);
  const [password, setPassword] = useState("");

  const submit = (event) => {
    event.preventDefault();

    if (!user.trim()) return;

    onLogin(user.trim());
  };

  return (
    <div className="login-page">
      <div className="login-glow glow-one" />
      <div className="login-glow glow-two" />

      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">M</div>

        <h1>Multi Stream Studio</h1>
        <p>Professional multi-platform streaming studio</p>

        <label>Username</label>
        <input
          value={user}
          onChange={(event) => setUser(event.target.value)}
          placeholder="Enter username"
          autoFocus
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
        />

        <button className="primary-button login-button">
          Login / Signin
        </button>

        <div className="login-note">
          Demo authentication. Data is stored locally in this browser.
        </div>
      </form>
    </div>
  );
}

function Editor({
  state,
  activeSources,
  activeSource,
  setModal,
  update,
  updateSource,
  toggleSource,
  toggleLock,
  moveSource,
  addScene,
  removeScene,
  moveScene,
  toggleStreaming
}) {
  return (
    <div className="editor-page">
      <section className="preview-section panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">EDITOR</div>
            <h2>Canvas Preview</h2>
          </div>

          <label className="switch-label">
            <span>Canvas Preview</span>
            <input
              type="checkbox"
              checked={state.canvasEnabled}
              onChange={(event) =>
                update({
                  canvasEnabled: event.target.checked
                })
              }
            />
            <span className="switch" />
          </label>
        </div>

        <div className="canvas-wrapper">
          {state.canvasEnabled ? (
            <Canvas
              sources={activeSources}
              selectedId={state.selectedSourceId}
              select={(id) => update({ selectedSourceId: id })}
              updateSource={updateSource}
            />
          ) : (
            <div className="canvas-disabled">
              <span>◉</span>
              <strong>Canvas Preview Disabled</strong>
              <small>Enable Canvas Preview to edit the scene.</small>
            </div>
          )}
        </div>
      </section>

      <section className="editor-grid">
        <ScenesPanel
          scenes={state.scenes}
          activeSceneId={state.activeSceneId}
          selectScene={(id) =>
            update({
              activeSceneId: id,
              selectedSourceId:
                state.sources[id]?.[0]?.id || null
            })
          }
          addScene={addScene}
          removeScene={removeScene}
          moveScene={moveScene}
        />

        <SourcesPanel
          sources={activeSources}
          selectedId={state.selectedSourceId}
          select={(id) => update({ selectedSourceId: id })}
          add={() => setModal({ type: "source" })}
          remove={removeSourceFromProps(activeSource)}
          toggleSource={toggleSource}
          toggleLock={toggleLock}
          moveSource={moveSource}
        />

        <AudioMixer
          mixer={state.mixer}
          update={(mixer) => update({ mixer })}
        />
      </section>

      <section className="bottom-grid">
        <Platforms
          platforms={state.platforms}
          update={(platforms) => update({ platforms })}
          setModal={setModal}
        />

        <Controls
          streaming={state.streaming}
          toggleStreaming={toggleStreaming}
        />
      </section>

      <UsageBar streaming={state.streaming} startedAt={state.startedAt} />
    </div>
  );
}

function removeSourceFromProps(activeSource) {
  return () => {
    window.dispatchEvent(
      new CustomEvent("mss-remove-source", {
        detail: activeSource
      })
    );
  };
}

function Canvas({
  sources,
  selectedId,
  select,
  updateSource
}) {
  const canvasRef = useRef(null);

  const handleDrag = (event, source) => {
    if (source.locked) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();

    const rect = canvas.getBoundingClientRect();

    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = source.x;
    const originalY = source.y;

    const move = (moveEvent) => {
      const dx =
        ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy =
        ((moveEvent.clientY - startY) / rect.height) * 100;

      updateSource(source.id, {
        x: Math.max(0, Math.min(100 - source.width, originalX + dx)),
        y: Math.max(0, Math.min(100 - source.height, originalY + dy))
      });
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className="canvas"
      ref={canvasRef}
      onClick={() => select(null)}
    >
      <div className="canvas-grid" />

      {sources
        .filter((source) => source.visible)
        .map((source) => (
          <div
            key={source.id}
            className={`canvas-source ${
              selectedId === source.id ? "selected" : ""
            }`}
            style={{
              left: `${source.x}%`,
              top: `${source.y}%`,
              width: `${source.width}%`,
              height: `${source.height}%`
            }}
            onClick={(event) => {
              event.stopPropagation();
              select(source.id);
            }}
            onPointerDown={(event) =>
              handleDrag(event, source)
            }
          >
            <SourceVisual source={source} />

            {selectedId === source.id && (
              <>
                <span className="resize-handle top-left" />
                <span className="resize-handle top-right" />
                <span className="resize-handle bottom-left" />
                <span className="resize-handle bottom-right" />
              </>
            )}

            <div className="source-label">
              {source.locked ? "🔒 " : ""}
              {source.name}
            </div>
          </div>
        ))}
    </div>
  );
}

function SourceVisual({ source }) {
  if (source.type === "image") {
    return (
      <div
        className="source-image"
        style={{
          background: `linear-gradient(135deg, ${
            source.color || "#2563eb"
          }, #7c3aed)`
        }}
      >
        <span>🖼</span>
        <small>Image</small>
      </div>
    );
  }

  if (source.type === "browser") {
    return (
      <div className="source-browser">
        <div className="browser-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-content">
          <span>🌐</span>
          <strong>Browser Source</strong>
          <small>{source.url || "Website"}</small>
        </div>
      </div>
    );
  }

  if (source.type === "media") {
    return (
      <div className="source-media">
        <span>▶</span>
        <strong>Media File</strong>
        <small>{source.loop ? "Loop enabled" : "Playback"}</small>
      </div>
    );
  }

  return (
    <div
      className="source-text"
      style={{
        color: source.color || "#fff",
        fontFamily: source.fontFamily || "Arial",
        fontSize: `${Math.min(source.fontSize || 32, 72)}px`
      }}
    >
      {source.text || "Text"}
    </div>
  );
}

function ScenesPanel({
  scenes,
  activeSceneId,
  selectScene,
  addScene,
  removeScene,
  moveScene
}) {
  return (
    <div className="panel lower-panel">
      <PanelTitle
        title="Scenes"
        actions={
          <>
            <button className="small-button" onClick={addScene}>
              +
            </button>
            <button className="small-button" onClick={removeScene}>
              −
            </button>
          </>
        }
      />

      <div className="scene-list">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            className={`scene-row ${
              activeSceneId === scene.id ? "selected" : ""
            }`}
            onClick={() => selectScene(scene.id)}
          >
            <span className="scene-icon">▣</span>
            {scene.name}
          </button>
        ))}
      </div>

      <div className="panel-actions">
        <button onClick={() => moveScene(-1)}>↑ Move Up</button>
        <button onClick={() => moveScene(1)}>↓ Move Down</button>
      </div>
    </div>
  );
}

function SourcesPanel({
  sources,
  selectedId,
  select,
  add,
  remove,
  toggleSource,
  toggleLock,
  moveSource
}) {
  return (
    <div className="panel lower-panel">
      <PanelTitle
        title="Sources"
        actions={
          <>
            <button className="small-button" onClick={add}>
              +
            </button>
            <button className="small-button" onClick={remove}>
              −
            </button>
          </>
        }
      />

      <div className="source-list">
        {sources.length === 0 && (
          <div className="empty-state">
            No sources.
            <br />
            Click + to add one.
          </div>
        )}

        {[...sources].reverse().map((source) => (
          <div
            key={source.id}
            className={`source-row ${
              selectedId === source.id ? "selected" : ""
            }`}
            onClick={() => select(source.id)}
          >
            <button
              className="visibility"
              onClick={(event) => {
                event.stopPropagation();
                toggleSource(source);
              }}
            >
              {source.visible ? "☑" : "☐"}
            </button>

            <span className="source-type-icon">
              {source.type === "image"
                ? "🖼"
                : source.type === "browser"
                ? "🌐"
                : source.type === "media"
                ? "🎬"
                : "T"}
            </span>

            <span className="source-name">
              {source.name}
            </span>

            <button
              className="lock-button"
              onClick={(event) => {
                event.stopPropagation();
                toggleLock(source);
              }}
            >
              {source.locked ? "🔒" : "🔓"}
            </button>
          </div>
        ))}
      </div>

      <div className="panel-actions">
        <button onClick={() => moveSource(1)}>↑ Move Up</button>
        <button onClick={() => moveSource(-1)}>
          ↓ Move Down
        </button>
      </div>
    </div>
  );
}

function AudioMixer({ mixer, update }) {
  return (
    <div className="panel lower-panel mixer-panel">
      <PanelTitle title="Audio Mixer" />

      <div className="mixer-channel">
        <div className="mixer-name">
          <span>🎬</span>
          Media File
        </div>

        <div className="volume-line">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            value={mixer.volume}
            onChange={(event) =>
              update({
                ...mixer,
                volume: Number(event.target.value)
              })
            }
          />
          <strong>{mixer.volume}%</strong>
        </div>

        <div className="mixer-actions">
          <button
            className={mixer.muted ? "danger-soft" : ""}
            onClick={() =>
              update({
                ...mixer,
                muted: !mixer.muted
              })
            }
          >
            {mixer.muted ? "🔇 Unmute" : "🔊 Mute"}
          </button>

          <button>⚙ Properties</button>
        </div>
      </div>
    </div>
  );
}

function Platforms({ platforms, update, setModal }) {
  const toggle = (id) => {
    update(
      platforms.map((platform) =>
        platform.id === id
          ? { ...platform, enabled: !platform.enabled }
          : platform
      )
    );
  };

  return (
    <div className="panel bottom-panel">
      <PanelTitle
        title="Platforms"
        actions={
          <>
            <button
              className="small-button"
              onClick={() => setModal({ type: "platform" })}
            >
              +
            </button>
            <button className="small-button">−</button>
          </>
        }
      />

      <div className="platform-list">
        {platforms.map((platform) => (
          <div className="platform-row" key={platform.id}>
            <button
              className="platform-check"
              onClick={() => toggle(platform.id)}
            >
              {platform.enabled ? "☑" : "☐"}
            </button>

            <div className="platform-logo">
              {platform.name === "YouTube"
                ? "▶"
                : platform.name === "Twitch"
                ? "♜"
                : platform.name === "Facebook"
                ? "f"
                : "●"}
            </div>

            <strong>{platform.name}</strong>

            <button
              className="edit-platform"
              onClick={() =>
                setModal({
                  type: "platform-edit",
                  platform
                })
              }
            >
              ✎ Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Controls({ streaming, toggleStreaming }) {
  return (
    <div className="panel bottom-panel controls-panel">
      <PanelTitle title="Controls" />

      <div className="control-status">
        <span className={streaming ? "live-dot" : "offline-dot"} />
        {streaming ? "LIVE" : "OFFLINE"}
      </div>

      <button
        className={`stream-button ${
          streaming ? "streaming" : ""
        }`}
        onClick={toggleStreaming}
      >
        {streaming
          ? "■  End Streaming"
          : "▶  Start Streaming"}
      </button>
    </div>
  );
}

function UsageBar({ streaming, startedAt }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () => clearInterval(interval);
  }, []);

  const uptime =
    streaming && startedAt
      ? formatDuration(Math.floor((now - startedAt) / 1000))
      : "00:00:00";

  const bitrate = streaming ? "6000" : "0";
  const fps = streaming ? "60" : "0";
  const cpu = streaming ? "12" : "4";
  const ram = "38";

  return (
    <div className="usage-bar">
      <Metric label="Uptime" value={uptime} />
      <Metric label="Bitrate" value={`${bitrate} kbit/s`} />
      <Metric label="FPS" value={fps} />
      <Metric label="CPU" value={`${cpu}%`} />
      <Metric label="RAM" value={`${ram}%`} />

      <div className="metric status-metric">
        <span>Status</span>
        <strong className={streaming ? "live-text" : ""}>
          <i className={streaming ? "live-dot" : "offline-dot"} />
          {streaming ? "Live" : "Offline"}
        </strong>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Settings({ state, update, notify }) {
  const page = state.settingsPage;
  const settings = state.settings[page];

  const save = (patch) => {
    update({
      settings: {
        ...state.settings,
        [page]: {
          ...settings,
          ...patch
        }
      }
    });

    notify(`${capitalize(page)} settings saved`);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <div className="eyebrow">SETTINGS</div>
          <h1>{capitalize(page)}</h1>
          <p>
            Configure your Multi Stream Studio
            {page === "advanced"
              ? " advanced behavior."
              : "."}
          </p>
        </div>
      </div>

      <div className="settings-card">
        {page === "authorization" && (
          <Authorization settings={settings} save={save} />
        )}

        {page === "stream" && (
          <StreamSettings settings={settings} save={save} />
        )}

        {page === "output" && (
          <OutputSettings settings={settings} save={save} />
        )}

        {page === "audio" && (
          <AudioSettings settings={settings} save={save} />
        )}

        {page === "video" && (
          <VideoSettings settings={settings} save={save} />
        )}

        {page === "advanced" && (
          <AdvancedSettings settings={settings} save={save} />
        )}
      </div>
    </div>
  );
}

function Authorization({ settings, save }) {
  const [form, setForm] = useState(settings);

  return (
    <SettingsForm
      title="Authorization"
      description="Configure the studio account."
      onSave={() => save(form)}
    >
      <Field
        label="Username"
        value={form.username}
        onChange={(value) =>
          setForm({ ...form, username: value })
        }
      />

      <Field
        label="Password"
        type="password"
        value={form.password}
        onChange={(value) =>
          setForm({ ...form, password: value })
        }
      />
    </SettingsForm>
  );
}

function StreamSettings({ settings, save }) {
  const [form, setForm] = useState(settings);

  return (
    <SettingsForm
      title="Stream"
      description="Configure the streaming destination."
      onSave={() => save(form)}
    >
      <SelectField
        label="Service"
        value={form.service}
        options={[
          "YouTube",
          "Facebook",
          "Twitch",
          "Kick",
          "Custom"
        ]}
        onChange={(value) =>
          setForm({ ...form, service: value })
        }
      />

      <Field
        label="Server"
        placeholder="rtmp://..."
        value={form.server}
        onChange={(value) =>
          setForm({ ...form, server: value })
        }
      />

      <Field
        label="Stream Key"
        type="password"
        value={form.streamKey}
        onChange={(value) =>
          setForm({ ...form, streamKey: value })
        }
      />
    </SettingsForm>
  );
}

function OutputSettings({ settings, save }) {
  const [form, setForm] = useState(settings);

  return (
    <SettingsForm
      title="Output"
      description="Configure video encoding parameters."
      onSave={() => save(form)}
    >
      <SelectField
        label="Encoder"
        value={form.encoder}
        options={["H.264", "H.265", "AV1"]}
        onChange={(value) =>
          setForm({ ...form, encoder: value })
        }
      />

      <SelectField
        label="Rate Control"
        value={form.rateControl}
        options={["CBR", "VBR", "CRF"]}
        onChange={(value) =>
          setForm({ ...form, rateControl: value })
        }
      />

      <Field
        label="Bitrate"
        value={form.bitrate}
        suffix="kbit/s"
        onChange={(value) =>
          setForm({ ...form, bitrate: value })
        }
      />

      <Field
        label="Keyframe Interval"
        value={form.keyframe}
        suffix="seconds"
        onChange={(value) =>
          setForm({ ...form, keyframe: value })
        }
      />

      <SelectField
        label="Preset"
        value={form.preset}
        options={["Quality", "Balanced", "Performance"]}
        onChange={(value) =>
          setForm({ ...form, preset: value })
        }
      />

      <SelectField
        label="Profile"
        value={form.profile}
        options={["Main", "High", "Baseline"]}
        onChange={(value) =>
          setForm({ ...form, profile: value })
        }
      />

      <SelectField
        label="Tune"
        value={form.tune}
        options={["None", "Film", "Animation", "Zero Latency"]}
        onChange={(value) =>
          setForm({ ...form, tune: value })
        }
      />
    </SettingsForm>
  );
}

function AudioSettings({ settings, save }) {
  const [form, setForm] = useState(settings);

  return (
    <SettingsForm
      title="Audio"
      description="Configure the audio encoder."
      onSave={() => save(form)}
    >
      <SelectField
        label="Encoder"
        value={form.encoder}
        options={["AAC", "Opus"]}
        onChange={(value) =>
          setForm({ ...form, encoder: value })
        }
      />

      <Field
        label="Bitrate"
        value={form.bitrate}
        suffix="kbit/s"
        onChange={(value) =>
          setForm({ ...form, bitrate: value })
        }
      />

      <SelectField
        label="Sample Rate"
        value={form.sampleRate}
        options={["44.1 kHz", "48 kHz"]}
        onChange={(value) =>
          setForm({ ...form, sampleRate: value })
        }
      />

      <SelectField
        label="Channels"
        value={form.channels}
        options={["Mono", "Stereo"]}
        onChange={(value) =>
          setForm({ ...form, channels: value })
        }
      />
    </SettingsForm>
  );
}

function VideoSettings({ settings, save }) {
  const [form, setForm] = useState(settings);

  const resolutions = [
    "1920x1080",
    "1280x720",
    "852x480",
    "640x360",
    "Custom"
  ];

  return (
    <SettingsForm
      title="Video"
      description="Configure canvas and output video."
      onSave={() => save(form)}
    >
      <SelectField
        label="Base Resolution (Canvas)"
        value={form.baseResolution}
        options={resolutions}
        onChange={(value) =>
          setForm({ ...form, baseResolution: value })
        }
      />

      <SelectField
        label="Output Resolution (Scaled)"
        value={form.outputResolution}
        options={resolutions}
        onChange={(value) =>
          setForm({ ...form, outputResolution: value })
        }
      />

      <SelectField
        label="FPS Values"
        value={form.fps}
        options={[
          "10",
          "20",
          "24 NTSC",
          "25",
          "29.97",
          "30",
          "48",
          "59.94",
          "60"
        ]}
        onChange={(value) =>
          setForm({ ...form, fps: value })
        }
      />
    </SettingsForm>
  );
}

function AdvancedSettings({ settings, save }) {
  const [form, setForm] = useState(settings);

  return (
    <SettingsForm
      title="Advanced"
      description="Configure advanced streaming behavior."
      onSave={() => save(form)}
    >
      <div className="setting-row checkbox-setting">
        <div>
          <strong>Automatically Reconnect</strong>
          <small>
            Automatically reconnect after a network interruption.
          </small>
        </div>

        <input
          type="checkbox"
          checked={form.reconnect}
          onChange={(event) =>
            setForm({
              ...form,
              reconnect: event.target.checked
            })
          }
        />
      </div>

      <SelectField
        label="Network"
        value={form.network}
        options={[
          "Default",
          "Low Latency",
          "High Stability"
        ]}
        onChange={(value) =>
          setForm({ ...form, network: value })
        }
      />
    </SettingsForm>
  );
}

function SettingsForm({
  title,
  description,
  children,
  onSave
}) {
  return (
    <div>
      <div className="settings-form-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="settings-fields">{children}</div>

      <div className="settings-footer">
        <button className="secondary-button">Cancel</button>
        <button className="primary-button" onClick={onSave}>
          Save
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  suffix
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        <input
          type={type}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function PanelTitle({ title, actions }) {
  return (
    <div className="panel-title">
      <h3>{title}</h3>
      {actions && <div className="panel-title-actions">{actions}</div>}
    </div>
  );
}

function Modal({ modal, close, onConfirm, addSource }) {
  if (modal.type === "scene") {
    return (
      <Dialog title="Add Scene" close={close}>
        <SceneDialog
          close={close}
          onConfirm={onConfirm}
        />
      </Dialog>
    );
  }

  if (modal.type === "source") {
    return (
      <Dialog title="Add Source" close={close}>
        <SourceDialog
          close={close}
          addSource={addSource}
        />
      </Dialog>
    );
  }

  if (modal.type === "platform") {
    return (
      <Dialog title="Add Platform" close={close}>
        <PlatformDialog
          close={close}
          addSource={addSource}
        />
      </Dialog>
    );
  }

  return (
    <Dialog title="Platform Settings" close={close}>
      <PlatformDialog
        close={close}
        platform={modal.platform}
      />
    </Dialog>
  );
}

function Dialog({ title, close, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={close}>×</button>
        </div>

        {children}
      </div>
    </div>
  );
}

function SceneDialog({ close, onConfirm }) {
  const [name, setName] = useState("");

  return (
    <div>
      <p className="modal-description">
        Please enter the name of the scene.
      </p>

      <Field
        label="Scene Name"
        value={name}
        placeholder="Scene 1"
        onChange={setName}
      />

      <div className="modal-actions">
        <button className="secondary-button" onClick={close}>
          Close
        </button>

        <button
          className="primary-button"
          onClick={() => onConfirm(name.trim())}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function SourceDialog({ close, addSource }) {
  const [type, setType] = useState("image");
  const [name, setName] = useState("");
  const [file, setFile] = useState("");
  const [url, setUrl] = useState("");
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  const [css, setCss] = useState("");
  const [loop, setLoop] = useState(false);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState("32");
  const [text, setText] = useState("My Text");
  const [color, setColor] = useState("#ffffff");

  const submit = () => {
    const source = {
      type,
      name:
        name.trim() ||
        (type === "image"
          ? "Image"
          : type === "browser"
          ? "Browser Source"
          : type === "media"
          ? "Media File"
          : "Text"),
      file,
      url,
      width,
      height,
      css,
      loop,
      fontFamily,
      fontSize: Number(fontSize) || 32,
      text,
      color
    };

    addSource(source);
  };

  return (
    <div>
      <div className="source-tabs">
        {[
          ["image", "🖼 Image"],
          ["browser", "🌐 Browser Source"],
          ["media", "🎬 Media File"],
          ["text", "T Text"]
        ].map(([id, label]) => (
          <button
            key={id}
            className={type === id ? "active" : ""}
            onClick={() => setType(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="modal-description">
        {type === "image" &&
          "Add images to your scene. Supports PNG, JPG, JPEG, GIF, TGA and BMP."}

        {type === "browser" &&
          "Add web-based content such as web pages, widgets and streaming video."}

        {type === "media" &&
          "Add videos or audio clips to your scene. Supports MP4, MP3 and WebM."}

        {type === "text" &&
          "Add text to your scene and adjust its style."}
      </p>

      <Field
        label="Source Name"
        value={name}
        onChange={setName}
      />

      {type === "image" && (
        <FileField
          label="Image File"
          value={file}
          onChange={setFile}
          accept=".png,.jpg,.jpeg,.gif,.tga,.bmp"
        />
      )}

      {type === "browser" && (
        <>
          <Field
            label="URL"
            value={url}
            placeholder="https://example.com"
            onChange={setUrl}
          />

          <div className="two-column">
            <Field
              label="Width"
              value={width}
              onChange={setWidth}
            />
            <Field
              label="Height"
              value={height}
              onChange={setHeight}
            />
          </div>

          <label className="field">
            <span>Custom CSS</span>
            <textarea
              value={css}
              onChange={(event) =>
                setCss(event.target.value)
              }
              placeholder="body { background: transparent; }"
            />
          </label>
        </>
      )}

      {type === "media" && (
        <>
          <FileField
            label="Local File"
            value={file}
            onChange={setFile}
            accept=".mp4,.mp3,.webm"
          />

          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={loop}
              onChange={(event) =>
                setLoop(event.target.checked)
              }
            />
            Loop
          </label>
        </>
      )}

      {type === "text" && (
        <>
          <div className="two-column">
            <Field
              label="Font Family"
              value={fontFamily}
              onChange={setFontFamily}
            />

            <Field
              label="Font Size"
              value={fontSize}
              onChange={setFontSize}
            />
          </div>

          <label className="field">
            <span>Text</span>
            <textarea
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
            />
          </label>

          <Field
            label="Color"
            value={color}
            onChange={setColor}
          />

          <div className="two-column">
            <Field
              label="Width"
              value={width}
              onChange={setWidth}
            />
            <Field
              label="Height"
              value={height}
              onChange={setHeight}
            />
          </div>
        </>
      )}

      <div className="modal-actions">
        <button className="secondary-button" onClick={close}>
          Close
        </button>

        <button className="primary-button" onClick={submit}>
          Add Source
        </button>
      </div>
    </div>
  );
}

function FileField({
  label,
  value,
  onChange,
  accept
}) {
  return (
    <label className="field">
      <span>{label}</span>

      <div className="file-input">
        <input
          type="text"
          value={value}
          placeholder="No file selected"
          readOnly
        />

        <label className="browse-button">
          Browse
          <input
            type="file"
            accept={accept}
            onChange={(event) =>
              onChange(
                event.target.files?.[0]?.name || ""
              )
            }
          />
        </label>
      </div>
    </label>
  );
}

function PlatformDialog({ close, platform, addSource }) {
  const [name, setName] = useState(
    platform?.name || "YouTube"
  );

  const [server, setServer] = useState(
    platform?.server || ""
  );

  const [streamKey, setStreamKey] = useState(
    platform?.streamKey || ""
  );

  const [enabled, setEnabled] = useState(
    platform?.enabled ?? true
  );

  const submit = () => {
    if (!platform) {
      addSource({
        type: "platform",
        name,
        server,
        streamKey,
        enabled
      });
    }

    close();
  };

  return (
    <div>
      <SelectField
        label="Platform"
        value={name}
        options={[
          "YouTube",
          "Facebook",
          "Twitch",
          "Kick",
          "Custom"
        ]}
        onChange={setName}
      />

      <Field
        label="Server"
        value={server}
        onChange={setServer}
        placeholder="rtmp://..."
      />

      <Field
        label="Stream Key"
        type="password"
        value={streamKey}
        onChange={setStreamKey}
      />

      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            setEnabled(event.target.checked)
          }
        />
        Enable Platform
      </label>

      <div className="modal-actions">
        <button className="secondary-button" onClick={close}>
          Cancel
        </button>

        <button className="primary-button" onClick={submit}>
          {platform ? "Save" : "Add Platform"}
        </button>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default App;
