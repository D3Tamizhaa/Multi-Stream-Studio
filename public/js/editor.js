window.editorModule = (() => {
  const state = {
    scenes: [], activeSceneId: null, selectedSourceId: null,
    platforms: [], selectedPlatformId: null,
    baseRes: { width: 1920, height: 1080 },
    previewOn: false, previewTimer: null, isLive: false
  };

  const el = (id) => document.getElementById(id);

  function activeScene() { return state.scenes.find((s) => s.id === state.activeSceneId); }
  function selectedSource() {
    const scene = activeScene();
    return scene ? scene.sources.find((s) => s.id === state.selectedSourceId) : null;
  }

  // ---------------- data loading ----------------
  async function loadScenes() {
    const data = await api.get('/api/scenes');
    state.scenes = data.scenes;
    state.activeSceneId = data.activeSceneId;
    render();
  }
  async function loadPlatforms() {
    const data = await api.get('/api/platforms');
    state.platforms = data.platforms;
    renderPlatforms();
  }
  async function loadBaseRes() {
    const data = await api.get('/api/settings');
    const v = data.settings.video;
    const map = { '1920x1080': [1920, 1080], '1280x720': [1280, 720], '852x480': [852, 480], '640x360': [640, 360] };
    const [w, h] = v.baseResolution === 'Custom' ? [v.baseCustom.width, v.baseCustom.height] : map[v.baseResolution];
    state.baseRes = { width: w, height: h };
    renderWorkspace();
  }

  function render() {
    renderScenesList();
    renderSourcesList();
    renderWorkspace();
    renderAudioMixer();
  }

  // ---------------- scenes ----------------
  function renderScenesList() {
    const list = el('scenes-list');
    list.innerHTML = '';
    if (!state.scenes.length) { list.innerHTML = '<div class="empty-hint">No scenes yet.</div>'; return; }
    state.scenes.forEach((scene, i) => {
      const row = document.createElement('div');
      row.className = `list-row${scene.id === state.activeSceneId ? ' active' : ''}`;
      row.innerHTML = `
        <span class="name">${escapeHtml(scene.name)}</span>
        <div class="row-actions">
          <button class="btn-icon" data-act="up" title="Move Up">↑</button>
          <button class="btn-icon" data-act="down" title="Move Down">↓</button>
          <button class="btn-icon" data-act="props" title="Properties">⚙</button>
        </div>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        setActiveScene(scene.id);
      });
      row.querySelector('[data-act="up"]').addEventListener('click', () => moveScene(scene.id, 'up'));
      row.querySelector('[data-act="down"]').addEventListener('click', () => moveScene(scene.id, 'down'));
      row.querySelector('[data-act="props"]').addEventListener('click', () => openRenameSceneModal(scene));
      list.appendChild(row);
    });
  }
  async function setActiveScene(id) {
    await api.post(`/api/scenes/${id}/activate`, {});
    state.activeSceneId = id;
    state.selectedSourceId = null;
    render();
  }
  async function moveScene(id, direction) {
    const data = await api.post(`/api/scenes/${id}/move`, { direction });
    if (data.scenes) state.scenes = data.scenes;
    renderScenesList();
  }

  el('scene-add-btn').addEventListener('click', () => openAddSceneModal());
  el('scene-remove-btn').addEventListener('click', async () => {
    if (!state.activeSceneId) return;
    if (state.scenes.length <= 1) return showToast('At least one scene must remain.', 'error');
    if (!confirm(`Remove scene "${activeScene().name}"?`)) return;
    try {
      await api.del(`/api/scenes/${state.activeSceneId}`);
      await loadScenes();
    } catch (e) { showToast(e.message, 'error'); }
  });

  function openAddSceneModal() {
    openModal(`
      <h3>Add Scene</h3>
      <div class="field"><label>Scene Name</label><input id="modal-scene-name" autofocus /></div>
      <div class="modal-actions">
        <button class="btn" data-close>Close</button>
        <button class="btn btn-primary" id="modal-scene-add">Add Scene</button>
      </div>`, (root) => {
      root.querySelector('#modal-scene-add').addEventListener('click', async () => {
        const name = root.querySelector('#modal-scene-name').value.trim();
        if (!name) return showToast('Enter a scene name.', 'error');
        try {
          const data = await api.post('/api/scenes', { name });
          closeModal();
          await loadScenes();
          setActiveScene(data.scene.id);
        } catch (e) { showToast(e.message, 'error'); }
      });
    });
  }
  function openRenameSceneModal(scene) {
    openModal(`
      <h3>Scene Properties</h3>
      <div class="field"><label>Scene Name</label><input id="modal-scene-rename" value="${escapeAttr(scene.name)}" /></div>
      <div class="modal-actions">
        <button class="btn" data-close>Close</button>
      </div>`, () => {});
  }

  // ---------------- sources ----------------
  function renderSourcesList() {
    const list = el('sources-list');
    const scene = activeScene();
    list.innerHTML = '';
    if (!scene || !scene.sources.length) { list.innerHTML = '<div class="empty-hint">No sources in this scene.</div>'; return; }
    const sorted = scene.sources.slice().sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    sorted.forEach((src) => {
      const row = document.createElement('div');
      row.className = `list-row${src.id === state.selectedSourceId ? ' active' : ''}`;
      row.innerHTML = `
        <span class="type-chip">${src.type}</span>
        <span class="name">${escapeHtml(src.name)}</span>
        <div class="row-actions">
          <button class="btn-icon${src.locked ? ' active' : ''}" data-act="lock" title="Lock / Unlock">${src.locked ? '🔒' : '🔓'}</button>
          <button class="btn-icon${src.shown === false ? '' : ' active'}" data-act="show" title="Show / Hide">${src.shown === false ? '◌' : '●'}</button>
          <button class="btn-icon" data-act="up" title="Move Up">↑</button>
          <button class="btn-icon" data-act="down" title="Move Down">↓</button>
          <button class="btn-icon" data-act="props" title="Properties">⚙</button>
        </div>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        state.selectedSourceId = src.id;
        render();
      });
      row.querySelector('[data-act="lock"]').addEventListener('click', () => patchSource(src.id, { locked: !src.locked }));
      row.querySelector('[data-act="show"]').addEventListener('click', () => patchSource(src.id, { shown: !(src.shown !== false) }));
      row.querySelector('[data-act="up"]').addEventListener('click', () => moveSource(src.id, 'up'));
      row.querySelector('[data-act="down"]').addEventListener('click', () => moveSource(src.id, 'down'));
      row.querySelector('[data-act="props"]').addEventListener('click', () => { state.selectedSourceId = src.id; render(); });
      list.appendChild(row);
    });
  }

  async function patchSource(id, patch) {
    const scene = activeScene();
    try {
      await api.put(`/api/scenes/${scene.id}/sources/${id}`, patch);
      await loadScenes();
      state.selectedSourceId = id;
      render();
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function moveSource(id, direction) {
    const scene = activeScene();
    await api.post(`/api/scenes/${scene.id}/sources/${id}/move`, { direction });
    await loadScenes();
  }

  el('source-add-btn').addEventListener('click', () => {
    if (!activeScene()) return showToast('Create a scene first.', 'error');
    openAddSourceModal();
  });
  el('source-remove-btn').addEventListener('click', async () => {
    const scene = activeScene();
    if (!scene || !state.selectedSourceId) return showToast('Select a source first.', 'error');
    try {
      await api.del(`/api/scenes/${scene.id}/sources/${state.selectedSourceId}`);
      state.selectedSourceId = null;
      await loadScenes();
    } catch (e) { showToast(e.message, 'error'); }
  });

  const FONT_CHOICES = ['DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'FreeSans', 'FreeSerif', 'FreeMono', 'Carlito', 'Caladea'];

  function openAddSourceModal() {
    let tab = 'image';
    const html = `
      <h3>Add Source</h3>
      <div class="modal-tabs">
        <button data-tab="image" class="active">Image</button>
        <button data-tab="media">Media</button>
        <button data-tab="text">Text</button>
      </div>
      <div class="field"><label>Source Name</label><input id="src-name" /></div>

      <div data-pane="image">
        <div class="field"><label>Image File</label>
          <label class="file-drop">Browse for PNG, JPG, JPEG, GIF, TGA, BMP
            <input type="file" id="src-image-file" accept=".png,.jpg,.jpeg,.gif,.tga,.bmp" />
          </label>
          <div class="filename" id="src-image-filename"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Width</label><input type="number" id="src-image-w" value="320" /></div>
          <div class="field"><label>Height</label><input type="number" id="src-image-h" value="180" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Position X</label><input type="number" id="src-image-x" value="0" /></div>
          <div class="field"><label>Position Y</label><input type="number" id="src-image-y" value="0" /></div>
        </div>
      </div>

      <div data-pane="media" class="hidden">
        <div class="field"><label>Local File</label>
          <label class="file-drop">Browse for MP4, MP3, WEBM
            <input type="file" id="src-media-file" accept=".mp4,.mp3,.webm" />
          </label>
          <div class="filename" id="src-media-filename"></div>
        </div>
        <div class="checkbox-row" style="margin-bottom:10px;"><input type="checkbox" id="src-media-loop" /><label for="src-media-loop">Loop</label></div>
        <div class="field-row">
          <div class="field"><label>Width</label><input type="number" id="src-media-w" value="480" /></div>
          <div class="field"><label>Height</label><input type="number" id="src-media-h" value="270" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Position X</label><input type="number" id="src-media-x" value="0" /></div>
          <div class="field"><label>Position Y</label><input type="number" id="src-media-y" value="0" /></div>
        </div>
      </div>

      <div data-pane="text" class="hidden">
        <div class="field-row">
          <div class="field"><label>Font Family</label>
            <select id="src-text-font">${FONT_CHOICES.map((f) => `<option>${f}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Font Size</label><input type="number" id="src-text-size" value="48" /></div>
        </div>
        <div class="field"><label>Text</label><textarea id="src-text-content" rows="2"></textarea></div>
        <div class="field"><label>Color</label><input type="color" id="src-text-color" value="#ffffff" /></div>
        <div class="field-row">
          <div class="field"><label>Position X</label><input type="number" id="src-text-x" value="40" /></div>
          <div class="field"><label>Position Y</label><input type="number" id="src-text-y" value="40" /></div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn" data-close>Close</button>
        <button class="btn btn-primary" id="src-add-submit">Add Source</button>
      </div>`;

    openModal(html, (root) => {
      root.querySelectorAll('.modal-tabs button').forEach((btn) => {
        btn.addEventListener('click', () => {
          tab = btn.dataset.tab;
          root.querySelectorAll('.modal-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
          root.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== tab));
        });
      });
      root.querySelector('#src-image-file').addEventListener('change', (e) => {
        root.querySelector('#src-image-filename').textContent = e.target.files[0] ? e.target.files[0].name : '';
      });
      root.querySelector('#src-media-file').addEventListener('change', (e) => {
        root.querySelector('#src-media-filename').textContent = e.target.files[0] ? e.target.files[0].name : '';
      });

      root.querySelector('#src-add-submit').addEventListener('click', async () => {
        const name = root.querySelector('#src-name').value.trim();
        if (!name) return showToast('Enter a source name.', 'error');
        try {
          let payload;
          if (tab === 'image') {
            const file = root.querySelector('#src-image-file').files[0];
            if (!file) return showToast('Choose an image file.', 'error');
            const up = await api.post('/api/uploads/image', formDataFor(file));
            payload = {
              name, type: 'image', file: up.file,
              width: num(root, '#src-image-w'), height: num(root, '#src-image-h'),
              x: num(root, '#src-image-x'), y: num(root, '#src-image-y')
            };
          } else if (tab === 'media') {
            const file = root.querySelector('#src-media-file').files[0];
            if (!file) return showToast('Choose a media file.', 'error');
            const up = await api.post('/api/uploads/media', formDataFor(file));
            payload = {
              name, type: 'media', file: up.file, loop: root.querySelector('#src-media-loop').checked,
              width: num(root, '#src-media-w'), height: num(root, '#src-media-h'),
              x: num(root, '#src-media-x'), y: num(root, '#src-media-y')
            };
          } else {
            payload = {
              name, type: 'text',
              fontFamily: root.querySelector('#src-text-font').value,
              fontSize: num(root, '#src-text-size'),
              text: root.querySelector('#src-text-content').value,
              color: root.querySelector('#src-text-color').value,
              x: num(root, '#src-text-x'), y: num(root, '#src-text-y')
            };
          }
          const scene = activeScene();
          const data = await api.post(`/api/scenes/${scene.id}/sources`, payload);
          closeModal();
          await loadScenes();
          state.selectedSourceId = data.source.id;
          render();
        } catch (e) { showToast(e.message, 'error'); }
      });
    });
  }

  function num(root, sel) { return Number(root.querySelector(sel).value) || 0; }
  function formDataFor(file) { const fd = new FormData(); fd.append('file', file); return fd; }

  // ---------------- workspace (drag / resize) ----------------
  function canvasScale() {
    const canvas = el('workspace-canvas');
    return canvas.clientWidth / state.baseRes.width;
  }

  function renderWorkspace() {
    const canvas = el('workspace-canvas');
    canvas.querySelectorAll('.src-box').forEach((n) => n.remove());
    const scene = activeScene();
    if (!scene) return;
    const scale = canvasScale();
    const sorted = scene.sources.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    sorted.forEach((src) => {
      if (src.shown === false) return;
      const box = document.createElement('div');
      box.className = `src-box${src.id === state.selectedSourceId ? ' selected' : ''}${src.locked ? ' locked' : ''}`;
      const isText = src.type === 'text';
      const w = isText ? Math.max(60, (src.text || '').length * (src.fontSize || 32) * 0.55) : (src.width || 100);
      const h = isText ? (src.fontSize || 32) * 1.4 : (src.height || 100);
      box.style.left = `${(src.x || 0) * scale}px`;
      box.style.top = `${(src.y || 0) * scale}px`;
      box.style.width = `${w * scale}px`;
      box.style.height = `${h * scale}px`;
      box.innerHTML = `<span class="src-label">${escapeHtml(src.name)}</span><div class="src-content"></div>`;
      const content = box.querySelector('.src-content');
      if (src.type === 'image' && src.file) {
        content.innerHTML = `<img src="/media/images/${src.file}" draggable="false" />`;
      } else if (src.type === 'media' && src.file) {
        content.innerHTML = `<video src="/media/media/${src.file}" muted playsinline></video>`;
      } else if (src.type === 'text') {
        content.innerHTML = `<div class="txt-content" style="font-size:${(src.fontSize || 32) * scale}px;color:${src.color || '#fff'};font-family:'${src.fontFamily || 'DejaVu Sans'}',sans-serif;">${escapeHtml(src.text || '')}</div>`;
      }
      if (!src.locked) {
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        if (isText) handle.style.display = 'none';
        box.appendChild(handle);
        wireResize(handle, box, src);
      }
      box.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        state.selectedSourceId = src.id;
        renderSourcesList(); renderInspector();
        document.querySelectorAll('.src-box').forEach((b) => b.classList.remove('selected'));
        box.classList.add('selected');
        if (!src.locked) wireDrag(e, box, src);
      });
      canvas.appendChild(box);
    });
    renderInspector();
  }

  function wireDrag(startEvt, box, src) {
    const scale = canvasScale();
    const startX = startEvt.clientX, startY = startEvt.clientY;
    const originX = src.x || 0, originY = src.y || 0;
    function onMove(e) {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const nx = Math.max(0, Math.round(originX + dx));
      const ny = Math.max(0, Math.round(originY + dy));
      box.style.left = `${nx * scale}px`;
      box.style.top = `${ny * scale}px`;
      src._pendingX = nx; src._pendingY = ny;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (src._pendingX !== undefined) patchSource(src.id, { x: src._pendingX, y: src._pendingY });
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function wireResize(handle, box, src) {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const scale = canvasScale();
      const startX = e.clientX, startY = e.clientY;
      const originW = src.width || 100, originH = src.height || 100;
      function onMove(ev) {
        const dw = (ev.clientX - startX) / scale;
        const dh = (ev.clientY - startY) / scale;
        const nw = Math.max(10, Math.round(originW + dw));
        const nh = Math.max(10, Math.round(originH + dh));
        box.style.width = `${nw * scale}px`;
        box.style.height = `${nh * scale}px`;
        src._pendingW = nw; src._pendingH = nh;
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (src._pendingW !== undefined) patchSource(src.id, { width: src._pendingW, height: src._pendingH });
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  window.addEventListener('resize', () => renderWorkspace());

  // ---------------- inspector ----------------
  function renderInspector() {
    const box = el('source-inspector');
    const src = selectedSource();
    if (!src) { box.innerHTML = '<p class="empty-hint">Select a source on the canvas to edit its position and size.</p>'; return; }
    const showWH = src.type !== 'text';
    box.innerHTML = `
      <div class="field"><label>Name</label><input id="insp-name" value="${escapeAttr(src.name)}" /></div>
      <div class="field-row">
        <div class="field"><label>Position X</label><input type="number" id="insp-x" value="${src.x || 0}" /></div>
        <div class="field"><label>Position Y</label><input type="number" id="insp-y" value="${src.y || 0}" /></div>
      </div>
      ${showWH ? `<div class="field-row">
        <div class="field"><label>Width</label><input type="number" id="insp-w" value="${src.width || 0}" /></div>
        <div class="field"><label>Height</label><input type="number" id="insp-h" value="${src.height || 0}" /></div>
      </div>` : ''}
      ${src.type === 'text' ? `
      <div class="field-row">
        <div class="field"><label>Font Family</label><select id="insp-font">${FONT_CHOICES.map((f) => `<option${f === src.fontFamily ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="field"><label>Font Size</label><input type="number" id="insp-size" value="${src.fontSize || 32}" /></div>
      </div>
      <div class="field"><label>Text</label><textarea id="insp-text" rows="2">${escapeHtml(src.text || '')}</textarea></div>
      <div class="field"><label>Color</label><input type="color" id="insp-color" value="${toHexColor(src.color)}" /></div>` : ''}
      ${src.type === 'media' ? `<div class="checkbox-row"><input type="checkbox" id="insp-loop" ${src.loop ? 'checked' : ''} /><label for="insp-loop">Loop</label></div>` : ''}
      <button class="btn btn-primary btn-block" id="insp-save" style="margin-top:8px;">Save Changes</button>
    `;
    box.querySelector('#insp-save').addEventListener('click', () => {
      const patch = {
        name: box.querySelector('#insp-name').value.trim() || src.name,
        x: num(box, '#insp-x'), y: num(box, '#insp-y')
      };
      if (showWH) { patch.width = num(box, '#insp-w'); patch.height = num(box, '#insp-h'); }
      if (src.type === 'text') {
        patch.fontFamily = box.querySelector('#insp-font').value;
        patch.fontSize = num(box, '#insp-size');
        patch.text = box.querySelector('#insp-text').value;
        patch.color = box.querySelector('#insp-color').value;
      }
      if (src.type === 'media') patch.loop = box.querySelector('#insp-loop').checked;
      patchSource(src.id, patch);
    });
  }
  function toHexColor(c) { return (c && c.startsWith('#') && c.length === 7) ? c : '#ffffff'; }

  // ---------------- audio mixer ----------------
  function renderAudioMixer() {
    const list = el('audio-mixer-list');
    const scene = activeScene();
    list.innerHTML = '';
    const mediaSources = scene ? scene.sources.filter((s) => s.type === 'media') : [];
    if (!mediaSources.length) { list.innerHTML = '<div class="empty-hint">No media sources in this scene.</div>'; return; }
    mediaSources.forEach((src) => {
      const strip = document.createElement('div');
      strip.className = 'mixer-strip';
      strip.innerHTML = `
        <div class="mixer-strip-top">
          <span class="name">${escapeHtml(src.name)}</span>
          <div class="row-actions">
            <button class="btn-icon${src.muted ? ' active' : ''}" data-act="mute" title="Mute / Unmute">${src.muted ? '🔇' : '🔊'}</button>
            <button class="btn-icon" data-act="props" title="Properties">⚙</button>
          </div>
        </div>
        <div class="vu-track"><div class="vu-fill" style="width:${src.muted ? 0 : (src.volume || 100)}%;"></div></div>
        <div class="mixer-strip-controls">
          <input type="range" min="0" max="150" value="${src.volume != null ? src.volume : 100}" data-act="volume" />
        </div>`;
      strip.querySelector('[data-act="mute"]').addEventListener('click', () => patchSource(src.id, { muted: !src.muted }));
      strip.querySelector('[data-act="volume"]').addEventListener('input', (e) => {
        strip.querySelector('.vu-fill').style.width = `${e.target.value}%`;
      });
      strip.querySelector('[data-act="volume"]').addEventListener('change', (e) => patchSource(src.id, { volume: Number(e.target.value) }));
      strip.querySelector('[data-act="props"]').addEventListener('click', () => openMonitorModal(src));
      list.appendChild(strip);
    });
  }

  function openMonitorModal(src) {
    const modes = ['Monitor Off', 'Monitor Only', 'Monitor and Output'];
    openModal(`
      <h3>${escapeHtml(src.name)} — Properties</h3>
      <div class="field"><label>Monitoring</label>
        <select id="monitor-select">${modes.map((m) => `<option${m === src.monitor ? ' selected' : ''}>${m}</option>`).join('')}</select>
      </div>
      <div class="hint">Monitor Off: output only. Monitor Only: local use only. Monitor and Output: both.</div>
      <div class="modal-actions">
        <button class="btn" data-close>Close</button>
        <button class="btn btn-primary" id="monitor-save">Save</button>
      </div>`, (root) => {
      root.querySelector('#monitor-save').addEventListener('click', () => {
        patchSource(src.id, { monitor: root.querySelector('#monitor-select').value });
        closeModal();
      });
    });
  }

  // ---------------- platforms ----------------
  function renderPlatforms() {
    const list = el('platforms-list');
    list.innerHTML = '';
    if (!state.platforms.length) { list.innerHTML = '<div class="empty-hint">No platforms added. Use + to add one.</div>'; return; }
    state.platforms.forEach((p) => {
      const row = document.createElement('div');
      row.className = `platform-row${p.id === state.selectedPlatformId ? ' active' : ''}`;
      row.innerHTML = `
        <span class="platform-dot${p.enabled ? ' enabled' : ''}"></span>
        <input type="checkbox" ${p.enabled ? 'checked' : ''} data-act="toggle" />
        <span class="name">${escapeHtml(p.name)}</span>
        <button class="btn-icon" data-act="edit" title="Edit">✎</button>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        state.selectedPlatformId = p.id;
        renderPlatforms();
      });
      row.querySelector('[data-act="toggle"]').addEventListener('change', async (e) => {
        await api.put(`/api/platforms/${p.id}`, { enabled: e.target.checked });
        await loadPlatforms();
      });
      row.querySelector('[data-act="edit"]').addEventListener('click', () => openEditPlatformModal(p));
      list.appendChild(row);
    });
  }

  function openEditPlatformModal(p) {
    openModal(`
      <h3>Edit Platform — ${escapeHtml(p.name)}</h3>
      ${p.service === 'RTMP' ? `<div class="field"><label>Server</label><input id="edit-server" value="${escapeAttr(p.server || '')}" /></div>` : ''}
      <div class="field"><label>Stream Key</label>
        <div class="stream-key-row">
          <input id="edit-key" type="password" value="${escapeAttr(p.streamKey || '')}" />
          <button class="btn btn-icon" id="edit-key-show">👁</button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-close>Close</button>
        <button class="btn btn-primary" id="edit-save">Save</button>
      </div>`, (root) => {
      root.querySelector('#edit-key-show').addEventListener('click', () => {
        const f = root.querySelector('#edit-key');
        f.type = f.type === 'password' ? 'text' : 'password';
      });
      root.querySelector('#edit-save').addEventListener('click', async () => {
        const patch = { streamKey: root.querySelector('#edit-key').value };
        if (p.service === 'RTMP') patch.server = root.querySelector('#edit-server').value;
        await api.put(`/api/platforms/${p.id}`, patch);
        closeModal();
        await loadPlatforms();
      });
    });
  }

  el('platform-add-btn').addEventListener('click', () => window.showSettingsView('stream'));
  el('platform-remove-btn').addEventListener('click', async () => {
    if (!state.selectedPlatformId) return showToast('Select a platform first.', 'error');
    await api.del(`/api/platforms/${state.selectedPlatformId}`);
    state.selectedPlatformId = null;
    await loadPlatforms();
  });

  // ---------------- streaming controls ----------------
  el('go-live-btn').addEventListener('click', async () => {
    try {
      if (state.isLive) {
        await api.post('/api/stream/stop');
      } else {
        await api.post('/api/stream/start');
      }
    } catch (e) { showToast(e.message, 'error'); }
  });
  function setLiveState(live) { state.isLive = live; }

  // ---------------- workspace preview ----------------
  el('preview-toggle').addEventListener('click', () => {
    state.previewOn = !state.previewOn;
    el('preview-toggle').classList.toggle('active', state.previewOn);
    el('workspace-canvas').classList.toggle('preview-off', !state.previewOn);
    if (state.previewOn) startPreviewLoop(); else stopPreviewLoop();
  });
  function startPreviewLoop() {
    stopPreviewLoop();
    const tick = async () => {
      const scene = activeScene();
      if (!scene) return;
      const url = `/api/preview/${scene.id}.jpg?t=${Date.now()}`;
      el('workspace-canvas').style.backgroundImage = `url('${url}')`;
    };
    tick();
    state.previewTimer = setInterval(tick, 2000);
  }
  function stopPreviewLoop() {
    if (state.previewTimer) clearInterval(state.previewTimer);
    state.previewTimer = null;
    el('workspace-canvas').style.backgroundImage = '';
  }

  // ---------------- modal helpers ----------------
  function openModal(html, onMount) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
    const backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    if (onMount) onMount(root);
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  return {
    init() { loadScenes(); loadPlatforms(); loadBaseRes(); },
    setLiveState,
    refreshBaseRes: loadBaseRes,
    refreshPlatforms: loadPlatforms
  };
})();
