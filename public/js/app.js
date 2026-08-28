const App = (() => {
  let videoSettings = null;
  let currentSettingsView = 'settings-stream';

  // ---------- Screens ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }

  // ---------- Login ----------
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('login-error');
    err.textContent = '';
    try {
      const res = await API.post('/api/auth/login', {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
      });
      document.getElementById('username-label').textContent = res.username;
      showScreen('app-screen');
      await boot();
    } catch (e2) {
      err.textContent = e2.message;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    Streaming.stop();
    await API.post('/api/auth/logout');
    showScreen('login-screen');
  });

  // ---------- Header / Nav ----------
  document.getElementById('menu-btn').addEventListener('click', () => {
    document.getElementById('side-nav').classList.toggle('hidden');
  });
  document.getElementById('user-menu-btn').addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.toggle('hidden');
  });
  document.getElementById('user-settings-link').addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.add('hidden');
    navigate('settings-authorization');
  });
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => { navigate(btn.dataset.view); document.getElementById('side-nav').classList.add('hidden'); });
  });

  function navigate(view) {
    document.getElementById('view-editor').classList.toggle('hidden', view !== 'editor');
    document.getElementById('view-settings').classList.toggle('hidden', view === 'editor');
    if (view !== 'editor') openSettings(view);
  }

  async function openSettings(view) {
    currentSettingsView = view;
    const titles = {
      'settings-authorization': 'Authorization', 'settings-stream': 'Stream',
      'settings-output': 'Output', 'settings-audio': 'Audio',
      'settings-video': 'Video', 'settings-advanced': 'Advanced'
    };
    document.getElementById('settings-title').textContent = titles[view];
    const body = document.getElementById('settings-body');
    body.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
    const renderers = {
      'settings-authorization': SettingsForms.renderAuthorization,
      'settings-stream': SettingsForms.renderStream,
      'settings-output': SettingsForms.renderOutput,
      'settings-audio': SettingsForms.renderAudio,
      'settings-video': SettingsForms.renderVideo,
      'settings-advanced': SettingsForms.renderAdvanced
    };
    App._applyFn = await renderers[view](body);
  }

  document.getElementById('settings-apply').addEventListener('click', async () => {
    try {
      if (App._applyFn) await App._applyFn();
      navigate('editor');
      await refreshVideoSettings();
    } catch (e) { alert(e.message); }
  });
  document.getElementById('settings-cancel').addEventListener('click', () => navigate('editor'));

  // ---------- Scenes ----------
  async function refreshScenes() {
    const { scenes, activeSceneId } = await API.get('/api/scenes');
    const list = document.getElementById('scene-list');
    list.innerHTML = '';
    scenes.forEach(scene => {
      const li = document.createElement('li');
      li.className = scene.id === activeSceneId ? 'active' : '';
      li.innerHTML = `<span>${scene.name}</span>
        <span class="row-actions">
          <button data-act="up">&uarr;</button><button data-act="down">&darr;</button>
        </span>`;
      li.querySelector('span:not(.row-actions)').addEventListener('click', async () => {
        await API.put(`/api/scenes/active/${scene.id}`);
        await refreshScenes();
      });
      li.querySelector('[data-act="up"]').addEventListener('click', async (e) => { e.stopPropagation(); await API.post(`/api/scenes/${scene.id}/move`, { direction: 'up' }); await refreshScenes(); });
      li.querySelector('[data-act="down"]').addEventListener('click', async (e) => { e.stopPropagation(); await API.post(`/api/scenes/${scene.id}/move`, { direction: 'down' }); await refreshScenes(); });
      list.appendChild(li);
    });
    const active = scenes.find(s => s.id === activeSceneId) || scenes[0];
    if (active) {
      Workspace.loadScene(active);
      await refreshSources(active);
      await refreshAudioMixer(active);
    }
    App._activeScene = active;
  }

  document.getElementById('scene-add').addEventListener('click', () => {
    Modal.prompt('Add Scene', 'Scene name', '', async (name) => {
      if (!name || !name.trim()) return;
      await API.post('/api/scenes', { name });
      await refreshScenes();
    });
  });
  document.getElementById('scene-remove').addEventListener('click', async () => {
    if (!App._activeScene) return;
    if (!confirm(`Remove scene "${App._activeScene.name}"?`)) return;
    await API.del(`/api/scenes/${App._activeScene.id}`);
    await refreshScenes();
  });

  // ---------- Sources ----------
  async function refreshSources(scene) {
    const list = document.getElementById('source-list');
    list.innerHTML = '';
    scene.sources.forEach(src => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${src.visible === false ? '(hidden) ' : ''}${src.name} <small style="color:var(--muted)">(${src.type})</small></span>
        <span class="row-actions">
          <button data-act="lock" title="Lock/Unlock">${src.locked ? '&#128274;' : '&#128275;'}</button>
          <button data-act="show" title="Show/Hide">${src.visible === false ? '&#128065;&#8203;' : '&#128065;'}</button>
          <button data-act="up">&uarr;</button><button data-act="down">&darr;</button>
          <button data-act="props">&#9881;</button>
        </span>`;
      li.addEventListener('click', () => { App._selectedSourceId = src.id; Workspace.setSelected(src.id); });
      li.querySelector('[data-act="lock"]').addEventListener('click', async (e) => { e.stopPropagation(); await API.put(`/api/scenes/${scene.id}/sources/${src.id}`, { locked: !src.locked }); await refreshScenes(); });
      li.querySelector('[data-act="show"]').addEventListener('click', async (e) => { e.stopPropagation(); await API.put(`/api/scenes/${scene.id}/sources/${src.id}`, { visible: src.visible === false }); await refreshScenes(); });
      li.querySelector('[data-act="up"]').addEventListener('click', async (e) => { e.stopPropagation(); await API.post(`/api/scenes/${scene.id}/sources/${src.id}/move`, { direction: 'up' }); await refreshScenes(); });
      li.querySelector('[data-act="down"]').addEventListener('click', async (e) => { e.stopPropagation(); await API.post(`/api/scenes/${scene.id}/sources/${src.id}/move`, { direction: 'down' }); await refreshScenes(); });
      li.querySelector('[data-act="props"]').addEventListener('click', (e) => { e.stopPropagation(); Modal.sourceProperties(scene, src, refreshScenes); });
      list.appendChild(li);
    });
  }

  document.getElementById('source-add').addEventListener('click', () => {
    if (!App._activeScene) return;
    Modal.addSource(App._activeScene, refreshScenes);
  });
  document.getElementById('source-remove').addEventListener('click', async () => {
    if (!App._activeScene || !App._selectedSourceId) return alert('Select a source first.');
    await API.del(`/api/scenes/${App._activeScene.id}/sources/${App._selectedSourceId}`);
    App._selectedSourceId = null;
    await refreshScenes();
  });

  document.addEventListener('ws:select', (e) => { App._selectedSourceId = e.detail; });
  document.addEventListener('ws:sourcechange', async (e) => {
    if (!App._activeScene) return;
    const s = e.detail;
    await API.put(`/api/scenes/${App._activeScene.id}/sources/${s.id}`, { x: s.x, y: s.y, width: s.width, height: s.height });
  });

  // ---------- Audio Mixer ----------
  async function refreshAudioMixer(scene) {
    const list = document.getElementById('audio-mixer-list');
    list.innerHTML = '';
    const mediaSources = scene.sources.filter(s => s.type === 'Media');
    mediaSources.forEach(src => {
      const li = document.createElement('li');
      li.style.flexDirection = 'column'; li.style.alignItems = 'stretch'; li.style.gap = '4px';
      li.innerHTML = `
        <div style="display:flex;justify-content:space-between;">
          <span>${src.name}</span>
          <button data-act="mute">${src.props.muted ? '&#128264;' : '&#128266;'}</button>
        </div>
        <input type="range" min="0" max="1.5" step="0.01" value="${src.props.volume ?? 1}" data-act="volume" />
        <select data-act="monitor">
          <option value="Monitor Off" ${src.props.monitor === 'Monitor Off' || !src.props.monitor ? 'selected' : ''}>Monitor Off</option>
          <option value="Monitor Only" ${src.props.monitor === 'Monitor Only' ? 'selected' : ''}>Monitor Only</option>
          <option value="Monitor and Output" ${src.props.monitor === 'Monitor and Output' ? 'selected' : ''}>Monitor and Output</option>
        </select>`;
      li.querySelector('[data-act="mute"]').addEventListener('click', async () => {
        const muted = !src.props.muted;
        Streaming.setMuted(src.id, muted);
        await API.put(`/api/scenes/${scene.id}/sources/${src.id}`, { props: { ...src.props, muted } });
        await refreshScenes();
      });
      li.querySelector('[data-act="volume"]').addEventListener('change', async (e) => {
        const volume = Number(e.target.value);
        Streaming.setVolume(src.id, volume);
        await API.put(`/api/scenes/${scene.id}/sources/${src.id}`, { props: { ...src.props, volume } });
      });
      li.querySelector('[data-act="monitor"]').addEventListener('change', async (e) => {
        await API.put(`/api/scenes/${scene.id}/sources/${src.id}`, { props: { ...src.props, monitor: e.target.value } });
      });
      list.appendChild(li);

      // connect this media element's audio into the mix graph once rendered
      setTimeout(() => {
        const node = document.querySelector(`.ws-source[data-id="${src.id}"] video`);
        if (node) Streaming.connectMediaAudio(src.id, node);
      }, 300);
    });
  }

  // ---------- Platforms ----------
  async function refreshPlatforms() {
    const platforms = await API.get('/api/platforms');
    const list = document.getElementById('platform-list');
    list.innerHTML = '';
    platforms.forEach(p => {
      const li = document.createElement('li');
      li.dataset.id = p.id;
      li.innerHTML = `
        <span><input type="checkbox" data-act="enable" ${p.enabled ? 'checked' : ''} /> ${p.name} <small style="color:var(--muted)">(${p.service})</small></span>
        <span class="row-actions"><button data-act="edit">&#9998;</button></span>`;
      li.querySelector('[data-act="enable"]').addEventListener('click', async (e) => {
        await API.put(`/api/platforms/${p.id}`, { enabled: e.target.checked });
      });
      li.querySelector('[data-act="edit"]').addEventListener('click', () => navigate('settings-stream'));
      li.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') App._selectedPlatformId = p.id; });
      list.appendChild(li);
    });
  }
  document.getElementById('platform-add').addEventListener('click', () => {
    Modal.addPlatform(async () => { await refreshPlatforms(); });
  });
  document.getElementById('platform-remove').addEventListener('click', async () => {
    if (!App._selectedPlatformId) return alert('Select a platform first.');
    await API.del(`/api/platforms/${App._selectedPlatformId}`);
    App._selectedPlatformId = null;
    await refreshPlatforms();
  });

  // ---------- Workspace preview toggle ----------
  let previewOn = true;
  document.getElementById('preview-toggle').addEventListener('click', (e) => {
    previewOn = !previewOn;
    e.target.classList.toggle('off', !previewOn);
    document.getElementById('workspace').style.visibility = previewOn ? 'visible' : 'hidden';
  });

  // ---------- Streaming controls ----------
document.getElementById('start-streaming-btn').addEventListener('click', async () => {
  try {
    await API.post('/api/stream/start');
    await Streaming.start(videoSettings ? videoSettings.fps : 30);
    document.getElementById('start-streaming-btn').classList.add('hidden');
    document.getElementById('end-streaming-btn').classList.remove('hidden');
  } catch (e) {
    alert('Failed to start streaming: ' + e.message);
    Streaming.stop();
    try {
      await API.post('/api/stream/stop');
    } catch (_) {}
  }
});

  document.getElementById('end-streaming-btn').addEventListener('click', async () => {
    Streaming.stop();
    await API.post('/api/stream/stop');
    document.getElementById('start-streaming-btn').classList.remove('hidden');
    document.getElementById('end-streaming-btn').classList.add('hidden');
  });

  function fmtUptime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function bindStats() {
    Streaming.subscribeStats((stats) => {
      document.getElementById('stat-uptime').textContent = fmtUptime(stats.uptime || 0);
      document.getElementById('stat-bitrate').textContent = `${Math.round(stats.bitrate || 0)} kbit/s`;
      document.getElementById('stat-fps').textContent = Math.round(stats.fps || 0);
      document.getElementById('stat-cpu').textContent = `${stats.cpu || 0}%`;
      document.getElementById('stat-ram').textContent = `${stats.ram || 0}%`;
      const pill = document.getElementById('stat-status');
      pill.textContent = stats.status.charAt(0).toUpperCase() + stats.status.slice(1);
      pill.className = 'status-pill ' + stats.status;
      const isLive = stats.status === 'live' || stats.status === 'starting';
      document.getElementById('start-streaming-btn').classList.toggle('hidden', isLive);
      document.getElementById('end-streaming-btn').classList.toggle('hidden', !isLive);
    });
  }

  async function refreshVideoSettings() {
    videoSettings = await API.get('/api/settings/video');
    const [w, h] = videoSettings.baseResolution === 'Custom'
      ? [videoSettings.baseCustom.width, videoSettings.baseCustom.height]
      : videoSettings.baseResolution.split('x').map(Number);
    Workspace.setBaseResolution(w, h);
    Workspace.render();
  }

  async function boot() {
    await refreshVideoSettings();
    await refreshScenes();
    await refreshPlatforms();
    bindStats();
    window.addEventListener('resize', () => Workspace.render());
  }

  async function checkSessionOnLoad() {
    const s = await API.get('/api/auth/session');
    if (s.authenticated) {
      document.getElementById('username-label').textContent = s.username;
      showScreen('app-screen');
      await boot();
    } else {
      showScreen('login-screen');
    }
  }

  return { navigate, refreshScenes, refreshPlatforms, checkSessionOnLoad };
})();

document.addEventListener('click', (e) => {
  const dd = document.getElementById('user-dropdown');
  if (dd && !dd.classList.contains('hidden') && !e.target.closest('.user-menu')) dd.classList.add('hidden');
});

App.checkSessionOnLoad();
