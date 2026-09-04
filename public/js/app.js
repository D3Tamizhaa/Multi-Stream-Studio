const App = (() => {
  let state = {
    scenes: [],
    activeSceneId: null,
    platforms: [],
    selectedSourceId: null,
    settings: null
  };

  // ---------------- View routing ----------------
  function goToView(name) {
    document.querySelectorAll('.view').forEach(v => v.hidden = true);
    const el = document.getElementById(`view-${name}`);
    if (el) el.hidden = false;
    closeDropdowns();

    if (name === 'settings-auth') SettingsUI.initAuth();
    if (name === 'settings-stream') SettingsUI.initStream();
    if (name === 'settings-output') SettingsUI.initOutput();
    if (name === 'settings-audio') SettingsUI.initAudio();
    if (name === 'settings-video') SettingsUI.initVideo();
    if (name === 'settings-advanced') SettingsUI.initAdvanced();
  }

  function closeDropdowns() {
    document.getElementById('menu-dropdown').hidden = true;
    document.getElementById('user-dropdown').hidden = true;
  }

  // ---------------- Header wiring ----------------
  function wireHeader() {
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      document.getElementById('user-dropdown').hidden = true;
      menuDropdown.hidden = !menuDropdown.hidden;
    };
    menuDropdown.querySelectorAll('[data-view]').forEach(a => {
      a.onclick = (e) => { e.preventDefault(); goToView(a.dataset.view); };
    });

    const userBtn = document.getElementById('user-btn');
    const userDropdown = document.getElementById('user-dropdown');
    userBtn.onclick = (e) => {
      e.stopPropagation();
      menuDropdown.hidden = true;
      userDropdown.hidden = !userDropdown.hidden;
    };
    document.getElementById('user-menu-username').onclick = (e) => { e.preventDefault(); goToView('settings-auth'); };
    document.getElementById('user-menu-logout').onclick = async (e) => {
      e.preventDefault();
      await api.post('/api/auth/logout');
      window.location.href = '/';
    };
    document.addEventListener('click', closeDropdowns);

    api.get('/api/auth/me').then(me => {
      document.getElementById('username-label').textContent = me.username;
    }).catch(() => { window.location.href = '/'; });
  }

  // ---------------- Scenes ----------------
  async function loadScenes() {
    const data = await api.get('/api/scenes');
    state.scenes = data.scenes;
    state.activeSceneId = data.activeSceneId;
    renderScenes();
    renderSources();
    renderAudioMixer();
  }

  function activeScene() {
    return state.scenes.find(s => s.id === state.activeSceneId) || state.scenes[0];
  }

  function renderScenes() {
    const ul = document.getElementById('scene-list');
    ul.innerHTML = '';
    if (!state.scenes.length) {
      ul.innerHTML = '<li class="empty-hint">No scenes yet.</li>';
      return;
    }
    state.scenes.forEach((scene, idx) => {
      const li = document.createElement('li');
      li.className = 'list-item' + (scene.id === state.activeSceneId ? ' selected' : '');
      li.innerHTML = `
        <span class="li-name">${escapeHtml(scene.name)}</span>
        <span class="li-icons">
          <button data-act="up" title="Move Up">▲</button>
          <button data-act="down" title="Move Down">▼</button>
          <button data-act="props" title="Properties">⚙</button>
        </span>`;
      li.querySelector('.li-name').onclick = async () => {
        await api.post(`/api/scenes/${scene.id}/activate`);
        state.activeSceneId = scene.id;
        renderScenes(); renderSources(); renderAudioMixer();
      };
      li.querySelector('[data-act="up"]').onclick = async (e) => { e.stopPropagation(); await api.post(`/api/scenes/${scene.id}/move`, { direction: 'up' }); loadScenes(); };
      li.querySelector('[data-act="down"]').onclick = async (e) => { e.stopPropagation(); await api.post(`/api/scenes/${scene.id}/move`, { direction: 'down' }); loadScenes(); };
      li.querySelector('[data-act="props"]').onclick = (e) => { e.stopPropagation(); openSceneProps(scene); };
      ul.appendChild(li);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('scene-add').onclick = () => openAddScene();
    document.getElementById('scene-remove').onclick = async () => {
      const scene = activeScene();
      if (!scene) return;
      if (!confirm(`Remove scene "${scene.name}"?`)) return;
      try { await api.del(`/api/scenes/${scene.id}`); await loadScenes(); }
      catch (e) { alert(e.message); }
    };
  });

  function openAddScene() {
    const modal = document.getElementById('modal-add-scene');
    const errEl = document.getElementById('add-scene-error');
    document.getElementById('add-scene-name').value = '';
    errEl.hidden = true;
    modal.hidden = false;
    document.getElementById('add-scene-close').onclick = () => modal.hidden = true;
    document.getElementById('form-add-scene').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api.post('/api/scenes', { name: document.getElementById('add-scene-name').value });
        modal.hidden = true;
        await loadScenes();
      } catch (err) {
        errEl.textContent = err.message; errEl.hidden = false;
      }
    };
  }

  function openSceneProps(scene) {
    const modal = document.getElementById('modal-scene-props');
    const errEl = document.getElementById('scene-props-error');
    document.getElementById('scene-props-name').value = scene.name;
    errEl.hidden = true;
    modal.hidden = false;
    document.getElementById('scene-props-close').onclick = () => modal.hidden = true;
    document.getElementById('form-scene-props').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api.post(`/api/scenes/${scene.id}/rename`, { name: document.getElementById('scene-props-name').value });
        modal.hidden = true;
        await loadScenes();
      } catch (err) {
        errEl.textContent = err.message; errEl.hidden = false;
      }
    };
  }

  // ---------------- Sources ----------------
  function renderSources() {
    const scene = activeScene();
    const ul = document.getElementById('source-list');
    ul.innerHTML = '';
    if (!scene || !scene.sources.length) {
      ul.innerHTML = '<li class="empty-hint">No sources in this scene.</li>';
      Workspace.render([]);
      return;
    }
    scene.sources.forEach(src => {
      const li = document.createElement('li');
      li.className = 'list-item' + (src.id === state.selectedSourceId ? ' selected' : '');
      li.innerHTML = `
        <span class="li-name">${iconFor(src.type)} ${escapeHtml(src.name)}</span>
        <span class="li-icons">
          <button data-act="lock" class="${src.locked ? 'active' : ''}" title="Lock/Unlock">${src.locked ? '🔒' : '🔓'}</button>
          <button data-act="show" class="${src.visible === false ? '' : 'active'}" title="Show/UnShow">${src.visible === false ? '🙈' : '👁'}</button>
          <button data-act="up" title="Move Up">▲</button>
          <button data-act="down" title="Move Down">▼</button>
          <button data-act="props" title="Properties">⚙</button>
        </span>`;
      li.querySelector('.li-name').onclick = () => { state.selectedSourceId = src.id; Workspace.select(src.id); renderSources(); };
      li.querySelector('[data-act="lock"]').onclick = async (e) => { e.stopPropagation(); await api.post(`/api/scenes/${scene.id}/sources/${src.id}/toggle`, { field: 'locked' }); loadScenes(); };
      li.querySelector('[data-act="show"]').onclick = async (e) => { e.stopPropagation(); await api.post(`/api/scenes/${scene.id}/sources/${src.id}/toggle`, { field: 'visible' }); loadScenes(); };
      li.querySelector('[data-act="up"]').onclick = async (e) => { e.stopPropagation(); await api.post(`/api/scenes/${scene.id}/sources/${src.id}/move`, { direction: 'up' }); loadScenes(); };
      li.querySelector('[data-act="down"]').onclick = async (e) => { e.stopPropagation(); await api.post(`/api/scenes/${scene.id}/sources/${src.id}/move`, { direction: 'down' }); loadScenes(); };
      li.querySelector('[data-act="props"]').onclick = (e) => { e.stopPropagation(); openSourceProps(scene, src); };
      ul.appendChild(li);
    });
    Workspace.render(scene.sources);
    if (state.selectedSourceId) Workspace.select(state.selectedSourceId);
  }

  function iconFor(type) {
    return { image: '🖼', media: '🎬', text: '🔤' }[type] || '●';
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('source-add').onclick = () => openAddSource();
    document.getElementById('source-remove').onclick = async () => {
      const scene = activeScene();
      if (!scene || !state.selectedSourceId) { alert('Select a source first.'); return; }
      const src = scene.sources.find(s => s.id === state.selectedSourceId);
      if (!src) return;
      if (!confirm(`Remove source "${src.name}"?`)) return;
      await api.del(`/api/scenes/${scene.id}/sources/${src.id}`);
      state.selectedSourceId = null;
      await loadScenes();
    };
  });

  // ---- Add source modal ----
  function openAddSource() {
    const modal = document.getElementById('modal-source');
    const errEl = document.getElementById('source-error');
    document.getElementById('form-source').reset();
    errEl.hidden = true;
    let currentType = 'image';
    setSourceType('image');
    modal.hidden = false;

    function setSourceType(type) {
      currentType = type;
      modal.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
      document.getElementById('source-image-fields').hidden = type !== 'image';
      document.getElementById('source-media-fields').hidden = type !== 'media';
      document.getElementById('source-text-fields').hidden = type !== 'text';
      const descs = {
        image: 'Add images to your scene. Supported formats: PNG, JPG, JPEG, GIF, TGA, BMP',
        media: 'Add videos or audio clips to your scene. Supported formats: MP4, MP3, WEBM',
        text: 'Add text to your scene and adjust its style.'
      };
      document.getElementById('source-desc').textContent = descs[type];
    }
    modal.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => setSourceType(b.dataset.type));
    document.getElementById('source-close').onclick = () => modal.hidden = true;

    document.getElementById('form-source').onsubmit = async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      const scene = activeScene();
      const payload = {
        type: currentType,
        name: document.getElementById('source-name').value,
        width: Number(document.getElementById('source-width').value),
        height: Number(document.getElementById('source-height').value),
        x: Number(document.getElementById('source-x').value),
        y: Number(document.getElementById('source-y').value)
      };
      try {
        if (currentType === 'image') {
          const fileInput = document.getElementById('source-image-file');
          if (!fileInput.files[0]) throw new Error('Please choose an image file.');
          const prog = document.getElementById('source-image-progress');
          prog.hidden = false;
          const up = await api.upload('/api/upload', fileInput.files[0], (pct) => {
            prog.querySelector('.upload-progress-bar').style.width = pct + '%';
          });
          payload.file = up.file;
        } else if (currentType === 'media') {
          const fileInput = document.getElementById('source-media-file');
          if (!fileInput.files[0]) throw new Error('Please choose a media file.');
          const prog = document.getElementById('source-media-progress');
          prog.hidden = false;
          const up = await api.upload('/api/upload', fileInput.files[0], (pct) => {
            prog.querySelector('.upload-progress-bar').style.width = pct + '%';
          });
          payload.file = up.file;
          payload.loop = document.getElementById('source-media-loop').checked;
        } else if (currentType === 'text') {
          payload.text = document.getElementById('source-text-value').value;
          payload.fontFamily = document.getElementById('source-text-font').value;
          payload.fontSize = Number(document.getElementById('source-text-size').value);
          payload.color = document.getElementById('source-text-color').value;
        }
        await api.post(`/api/scenes/${scene.id}/sources`, payload);
        modal.hidden = true;
        await loadScenes();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    };
  }

  // ---- Source properties modal ----
  function openSourceProps(scene, src) {
    const modal = document.getElementById('modal-props');
    document.getElementById('props-title').textContent = `Properties — ${src.name}`;
    document.getElementById('props-width').value = src.width;
    document.getElementById('props-height').value = src.height;
    document.getElementById('props-x').value = src.x;
    document.getElementById('props-y').value = src.y;

    document.getElementById('props-text-fields').hidden = src.type !== 'text';
    document.getElementById('props-media-fields').hidden = src.type !== 'media';
    if (src.type === 'text') {
      document.getElementById('props-text-value').value = src.text || '';
      document.getElementById('props-text-font').value = src.fontFamily || 'Arial';
      document.getElementById('props-text-size').value = src.fontSize || 32;
      document.getElementById('props-text-color').value = colorToHex(src.color);
    }
    if (src.type === 'media') {
      document.getElementById('props-media-loop').checked = !!src.loop;
    }

    modal.hidden = false;
    document.getElementById('props-close').onclick = () => modal.hidden = true;
    document.getElementById('form-props').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        width: Number(document.getElementById('props-width').value),
        height: Number(document.getElementById('props-height').value),
        x: Number(document.getElementById('props-x').value),
        y: Number(document.getElementById('props-y').value)
      };
      if (src.type === 'text') {
        payload.text = document.getElementById('props-text-value').value;
        payload.fontFamily = document.getElementById('props-text-font').value;
        payload.fontSize = Number(document.getElementById('props-text-size').value);
        payload.color = document.getElementById('props-text-color').value;
      }
      if (src.type === 'media') {
        payload.loop = document.getElementById('props-media-loop').checked;
      }
      await api.put(`/api/scenes/${scene.id}/sources/${src.id}`, payload);
      modal.hidden = true;
      await loadScenes();
    };
  }

  function colorToHex(c) {
    if (!c) return '#ffffff';
    if (c.startsWith('0x')) return '#' + c.slice(2);
    if (c.startsWith('#')) return c;
    return '#ffffff';
  }

  // ---------------- Audio Mixer ----------------
  function renderAudioMixer() {
    const scene = activeScene();
    const box = document.getElementById('audio-mixer');
    box.innerHTML = '';
    const mediaSources = (scene ? scene.sources : []).filter(s => s.type === 'media');
    if (!mediaSources.length) {
      box.innerHTML = '<div class="empty-hint">No media sources with audio.</div>';
      return;
    }
    mediaSources.forEach(src => {
      const row = document.createElement('div');
      row.className = 'mixer-row';
      row.innerHTML = `
        <div class="mixer-row-top">
          <span>${escapeHtml(src.name)}</span>
          <button class="mute-btn ${src.muted ? 'muted' : ''}">${src.muted ? 'Muted' : 'Mute'}</button>
        </div>
        <input type="range" min="0" max="1.5" step="0.05" value="${src.volume ?? 1}">
      `;
      const range = row.querySelector('input[type=range]');
      const muteBtn = row.querySelector('.mute-btn');
      let debounce;
      range.oninput = () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          await api.put(`/api/scenes/${scene.id}/sources/${src.id}`, { volume: Number(range.value) });
        }, 200);
      };
      muteBtn.onclick = async () => {
        await api.post(`/api/scenes/${scene.id}/sources/${src.id}/toggle`, { field: 'muted' });
        loadScenes();
      };
      box.appendChild(row);
    });
  }

  // ---------------- Platforms ----------------
  async function reloadPlatforms() {
    const data = await api.get('/api/platforms');
    state.platforms = data.platforms;
    renderPlatforms();
  }

  function renderPlatforms() {
    const ul = document.getElementById('platform-list');
    ul.innerHTML = '';
    if (!state.platforms.length) {
      ul.innerHTML = '<li class="empty-hint">No platforms added yet.</li>';
      return;
    }
    let selectedId = null;
    state.platforms.forEach(p => {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.dataset.id = p.id;
      li.innerHTML = `
        <label class="li-name" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" ${p.enabled ? 'checked' : ''}> ${escapeHtml(p.name)}
        </label>
        <span class="li-icons"><button data-act="edit" title="Edit">✎</button></span>`;
      li.querySelector('input[type=checkbox]').onchange = async () => {
        await api.post(`/api/platforms/${p.id}/toggle`);
        reloadPlatforms();
      };
      li.querySelector('[data-act="edit"]').onclick = () => openPlatformEdit(p);
      li.onclick = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
        document.querySelectorAll('#platform-list .list-item').forEach(n => n.classList.remove('selected'));
        li.classList.add('selected');
        selectedId = p.id;
        ul.dataset.selected = p.id;
      };
      ul.appendChild(li);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('platform-add').onclick = () => goToView('settings-stream');
    document.getElementById('platform-remove').onclick = async () => {
      const ul = document.getElementById('platform-list');
      const id = ul.dataset.selected;
      if (!id) { alert('Select a platform first.'); return; }
      if (!confirm('Remove this platform?')) return;
      await api.del(`/api/platforms/${id}`);
      delete ul.dataset.selected;
      reloadPlatforms();
    };
  });

  function openPlatformEdit(p) {
    const modal = document.getElementById('modal-platform-edit');
    document.getElementById('platform-edit-title').textContent = `Edit — ${p.name}`;
    document.getElementById('platform-edit-server-row').style.display = p.service === 'RTMP' ? 'block' : 'none';
    document.getElementById('platform-edit-server').value = p.server;
    document.getElementById('platform-edit-server').readOnly = p.service !== 'RTMP';
    document.getElementById('platform-edit-key').value = p.key;
    document.getElementById('platform-edit-key').type = 'password';
    document.getElementById('platform-edit-key-show').textContent = 'Show';
    modal.hidden = false;
    document.getElementById('platform-edit-close').onclick = () => modal.hidden = true;
    document.getElementById('platform-edit-key-show').onclick = () => {
      const el = document.getElementById('platform-edit-key');
      const show = el.type === 'password';
      el.type = show ? 'text' : 'password';
      document.getElementById('platform-edit-key-show').textContent = show ? 'Hide' : 'Show';
    };
    document.getElementById('form-platform-edit').onsubmit = async (e) => {
      e.preventDefault();
      await api.put(`/api/platforms/${p.id}`, {
        server: document.getElementById('platform-edit-server').value,
        key: document.getElementById('platform-edit-key').value
      });
      modal.hidden = true;
      reloadPlatforms();
    };
  }

  // ---------------- Streaming controls + status ----------------
  function wireControls() {
    document.getElementById('btn-start-stream').onclick = async () => {
      try {
        await api.post('/api/stream/start');
      } catch (e) {
        alert(e.message);
      }
    };
    document.getElementById('btn-end-stream').onclick = async () => {
      await api.post('/api/stream/stop');
    };
  }

  function applyStatus(snapshot) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const uptime = document.getElementById('status-uptime');
    const startBtn = document.getElementById('btn-start-stream');
    const endBtn = document.getElementById('btn-end-stream');

    dot.className = 'status-dot ' + snapshot.status;
    const labels = { idle: 'Idle', starting: 'Starting…', live: 'Live', reconnecting: 'Reconnecting…', error: 'Error' };
    text.textContent = labels[snapshot.status] || snapshot.status;

    const h = String(Math.floor(snapshot.uptimeSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((snapshot.uptimeSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(snapshot.uptimeSeconds % 60).padStart(2, '0');
    uptime.textContent = `${h}:${m}:${s}`;

    const running = snapshot.status !== 'idle';
    startBtn.hidden = running;
    endBtn.hidden = !running;
  }

  function connectStatusSocket() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/status`);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'status') applyStatus(msg.data);
    };
    ws.onclose = () => setTimeout(connectStatusSocket, 2000);
  }

  // ---------------- Preview toggle ----------------
  function wirePreviewToggle() {
    const btn = document.getElementById('preview-toggle');
    let on = true;
    btn.onclick = () => {
      on = !on;
      btn.classList.toggle('off', !on);
      document.getElementById('workspace').style.visibility = on ? 'visible' : 'hidden';
    };
  }

  // ---------------- Canvas size (from Video settings) ----------------
  async function reloadCanvasSize() {
    const settings = (await api.get('/api/settings')).settings;
    state.settings = settings;
    const w = settings.video.resolution === 'custom' ? settings.video.customWidth : Number(settings.video.resolution.split('x')[0]);
    const h = settings.video.resolution === 'custom' ? settings.video.customHeight : Number(settings.video.resolution.split('x')[1]);
    Workspace.setCanvasSize(w, h);
    renderSources();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

async function init() {
  try {
    wireHeader();
    wireControls();
    wirePreviewToggle();

    Workspace.init(document.getElementById('workspace'));

    Workspace.setHandlers({
      change: async (sourceId, rect) => {
        const scene = activeScene();
        if (!scene) return;

        await api.put(
          `/api/scenes/${scene.id}/sources/${sourceId}`,
          rect
        );

        const src = scene.sources.find(s => s.id === sourceId);
        if (src) Object.assign(src, rect);
      },

      select: (id) => {
        state.selectedSourceId = id;
        renderSources();
      }
    });

    // Show editor immediately.
    goToView('editor');

    // Load data independently so one failed API doesn't destroy the UI.
    try {
      await reloadCanvasSize();
    } catch (err) {
      console.error('Failed to load video settings:', err);
    }

    try {
      await loadScenes();
    } catch (err) {
      console.error('Failed to load scenes:', err);
    }

    try {
      await reloadPlatforms();
    } catch (err) {
      console.error('Failed to load platforms:', err);
    }

    try {
      const status = await api.get('/api/stream/status');
      applyStatus(status);
    } catch (err) {
      console.error('Failed to load stream status:', err);
    }

    connectStatusSocket();

  } catch (err) {
    console.error('Studio initialization failed:', err);

    // Never leave the application blank.
    goToView('editor');

    const sceneList = document.getElementById('scene-list');
    if (sceneList && !sceneList.children.length) {
      sceneList.innerHTML =
        '<li class="empty-hint">Studio loaded. Some data could not be loaded.</li>';
    }
  }
}

  return { goToView, reloadPlatforms, reloadCanvasSize, init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
