const EditorModule = (() => {
  let scenesData = null; // { activeSceneId, scenes: [...] }
  let platformsData = null; // { platforms: [...] }
  let selectedSourceId = null;
  let previewOn = true;
  let currentStreamStatus = { status: 'idle', uptimeSeconds: 0 };

  function activeScene() {
    return scenesData.scenes.find((s) => s.id === scenesData.activeSceneId);
  }

  // ================= Init =================
  function init() {
    document.getElementById('scene-add-btn').addEventListener('click', onAddScene);
    document.getElementById('scene-remove-btn').addEventListener('click', onRemoveSelectedScene);

    const sourceAddBtn = document.getElementById('source-add-btn');
    const sourceAddMenu = document.getElementById('source-add-menu');
    sourceAddBtn.addEventListener('click', (e) => { e.stopPropagation(); sourceAddMenu.classList.toggle('hidden'); });
    document.addEventListener('click', () => sourceAddMenu.classList.add('hidden'));
    sourceAddMenu.querySelectorAll('[data-source-type]').forEach((btn) => {
      btn.addEventListener('click', () => { sourceAddMenu.classList.add('hidden'); openAddSourceModal(btn.dataset.sourceType); });
    });
    document.getElementById('source-remove-btn').addEventListener('click', onRemoveSelectedSource);

    document.getElementById('platform-add-btn').addEventListener('click', () => showView('settings-stream'));
    document.getElementById('platform-remove-btn').addEventListener('click', onRemoveSelectedPlatform);

    document.getElementById('preview-toggle').addEventListener('click', togglePreview);

    document.getElementById('start-streaming-btn').addEventListener('click', onStartStreaming);
    document.getElementById('end-streaming-btn').addEventListener('click', onEndStreaming);

    refreshAll();
    setInterval(tickUptime, 1000);
  }

  async function refreshAll() {
    await Promise.all([loadScenes(), loadPlatforms()]);
    renderAll();
  }

  async function loadScenes() {
    scenesData = await api.get('/api/scenes');
  }
  async function loadPlatforms() {
    platformsData = await api.get('/api/settings/platforms');
  }

  function renderAll() {
    renderScenes();
    renderSources();
    renderWorkspace();
    renderAudioMixer();
    renderPlatforms();
  }

  // ================= Scenes =================
  function renderScenes() {
    const list = document.getElementById('scene-list');
    list.innerHTML = '';
    if (!scenesData.scenes.length) {
      list.innerHTML = '<div class="empty-hint">No scenes yet</div>';
      return;
    }
    scenesData.scenes.forEach((scene, idx) => {
      const row = document.createElement('div');
      row.className = 'list-row' + (scene.id === scenesData.activeSceneId ? ' active' : '') + (scene.id === selectedSceneId ? ' selected-row' : '');
      row.innerHTML = `
        <span class="name" title="${escapeHtml(scene.name)}">${escapeHtml(scene.name)}</span>
        <div class="row-actions">
          <button class="tiny-btn" data-act="up" title="Move Up">↑</button>
          <button class="tiny-btn" data-act="down" title="Move Down">↓</button>
          <button class="tiny-btn" data-act="props" title="Properties">⚙</button>
        </div>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.tiny-btn')) return;
        selectedSceneId = scene.id;
        setActiveScene(scene.id);
      });
      row.querySelector('[data-act="up"]').addEventListener('click', () => moveScene(scene.id, 'up'));
      row.querySelector('[data-act="down"]').addEventListener('click', () => moveScene(scene.id, 'down'));
      row.querySelector('[data-act="props"]').addEventListener('click', () => openRenameSceneModal(scene));
      list.appendChild(row);
    });
  }

  let selectedSceneId = null;

  async function onAddScene() {
    openPromptModal('Add Scene', 'Enter scene name', '', async (name) => {
      if (!name || !name.trim()) return 'Scene name is required';
      try {
        const scene = await api.post('/api/scenes', { name: name.trim() });
        await loadScenes();
        selectedSceneId = scene.id;
        renderScenes();
        renderSources();
      } catch (e) { return e.message; }
    });
  }

  async function onRemoveSelectedScene() {
    if (!selectedSceneId) return alert('Select a scene first');
    if (scenesData.scenes.length <= 1) return alert('At least one scene must remain');
    if (!confirm('Remove this scene?')) return;
    await api.del(`/api/scenes/${selectedSceneId}`);
    selectedSceneId = null;
    await loadScenes();
    renderAll();
  }

  async function moveScene(id, direction) {
    scenesData = await api.put(`/api/scenes/${id}/move`, { direction });
    renderScenes();
  }

  async function setActiveScene(id) {
    scenesData = await api.put(`/api/scenes/active/${id}`, {});
    renderScenes();
    renderSources();
    renderWorkspace();
    renderAudioMixer();
  }

  function openRenameSceneModal(scene) {
    openPromptModal('Scene Properties', 'Scene name', scene.name, async (name) => {
      if (!name || !name.trim()) return 'Scene name is required';
      try {
        await api.put(`/api/scenes/${scene.id}/rename`, { name: name.trim() });
        await loadScenes();
        renderScenes();
      } catch (e) { return e.message; }
    });
  }

  // ================= Sources =================
  let selectedSourceRowId = null;

  function renderSources() {
    const list = document.getElementById('source-list');
    list.innerHTML = '';
    const scene = activeScene();
    if (!scene || !scene.sources.length) {
      list.innerHTML = '<div class="empty-hint">No sources in this scene</div>';
      return;
    }
    scene.sources.forEach((src) => {
      const row = document.createElement('div');
      row.className = 'list-row' + (src.id === selectedSourceRowId ? ' active' : '');
      const icon = src.type === 'image' ? '🖼' : src.type === 'media' ? '🎞' : '🔤';
      row.innerHTML = `
        <span class="name">${icon} ${escapeHtml(src.name)}</span>
        <div class="row-actions">
          <button class="tiny-btn ${src.locked ? 'on' : ''}" data-act="lock" title="Lock/Unlock">${src.locked ? '🔒' : '🔓'}</button>
          <button class="tiny-btn ${src.shown ? 'on' : ''}" data-act="show" title="Show/Hide">${src.shown ? '👁' : '🚫'}</button>
          <button class="tiny-btn" data-act="up" title="Move Up">↑</button>
          <button class="tiny-btn" data-act="down" title="Move Down">↓</button>
          <button class="tiny-btn" data-act="props" title="Properties">⚙</button>
        </div>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.tiny-btn')) return;
        selectedSourceRowId = src.id;
        selectedSourceId = src.id;
        renderSources();
        renderWorkspace();
      });
      row.querySelector('[data-act="lock"]').addEventListener('click', () => updateSource(src.id, { locked: !src.locked }));
      row.querySelector('[data-act="show"]').addEventListener('click', () => updateSource(src.id, { shown: !src.shown }));
      row.querySelector('[data-act="up"]').addEventListener('click', () => moveSource(src.id, 'up'));
      row.querySelector('[data-act="down"]').addEventListener('click', () => moveSource(src.id, 'down'));
      row.querySelector('[data-act="props"]').addEventListener('click', () => openEditSourceModal(src));
      list.appendChild(row);
    });
  }

  async function onRemoveSelectedSource() {
    if (!selectedSourceRowId) return alert('Select a source first');
    const scene = activeScene();
    if (!confirm('Remove this source?')) return;
    await api.del(`/api/scenes/${scene.id}/sources/${selectedSourceRowId}`);
    selectedSourceRowId = null;
    selectedSourceId = null;
    await loadScenes();
    renderSources();
    renderWorkspace();
    renderAudioMixer();
  }

  async function moveSource(id, direction) {
    const scene = activeScene();
    await api.put(`/api/scenes/${scene.id}/sources/${id}/move`, { direction });
    await loadScenes();
    renderSources();
  }

  async function updateSource(id, patch) {
    const scene = activeScene();
    await api.put(`/api/scenes/${scene.id}/sources/${id}`, patch);
    await loadScenes();
    renderSources();
    renderWorkspace();
    renderAudioMixer();
  }

  function openAddSourceModal(type) {
    if (type === 'image') return openImageSourceModal();
    if (type === 'media') return openMediaSourceModal();
    if (type === 'text') return openTextSourceModal();
  }

  function openEditSourceModal(src) {
    if (src.type === 'image') return openImageSourceModal(src);
    if (src.type === 'media') return openMediaSourceModal(src);
    if (src.type === 'text') return openTextSourceModal(src);
  }

  function openImageSourceModal(existing) {
    const isEdit = !!existing;
    const html = `
      <h3>${isEdit ? 'Image Source' : 'Add Image Source'}</h3>
      <div class="field-row"><label>Source Name</label><input id="m-name" type="text" value="${existing ? escapeAttr(existing.name) : ''}" /></div>
      <div class="field-row"><label>Image File</label>
        <input id="m-file" type="file" accept=".png,.jpg,.jpeg,.gif,.tga,.bmp" />
        <div class="small-note">${existing && existing.file ? 'Current: ' + escapeHtml(existing.file) : 'PNG, JPG, JPEG, GIF, TGA, BMP'}</div>
      </div>
      <div class="field-grid">
        <div class="field-row"><label>Width</label><input id="m-width" type="number" value="${existing ? existing.width : 320}" /></div>
        <div class="field-row"><label>Height</label><input id="m-height" type="number" value="${existing ? existing.height : 180}" /></div>
        <div class="field-row"><label>Position X</label><input id="m-x" type="number" value="${existing ? existing.x : 0}" /></div>
        <div class="field-row"><label>Position Y</label><input id="m-y" type="number" value="${existing ? existing.y : 0}" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">Close</button>
        <button class="btn btn-primary" id="m-save">${isEdit ? 'Save' : 'Add Source'}</button>
      </div>`;
    renderModal(html, async () => {
      const name = document.getElementById('m-name').value.trim();
      if (!name) return alert('Source name is required');
      const fileInput = document.getElementById('m-file');
      let fileName = existing ? existing.file : undefined;
      if (fileInput.files[0]) {
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        const up = await api.post('/api/upload?kind=image', fd);
        fileName = up.file;
      }
      const payload = {
        name, file: fileName,
        width: Number(document.getElementById('m-width').value) || 320,
        height: Number(document.getElementById('m-height').value) || 180,
        x: Number(document.getElementById('m-x').value) || 0,
        y: Number(document.getElementById('m-y').value) || 0,
      };
      await saveSource('image', existing, payload);
      closeModal();
    });
  }

  function openMediaSourceModal(existing) {
    const isEdit = !!existing;
    const html = `
      <h3>${isEdit ? 'Media Source' : 'Add Media Source'}</h3>
      <div class="field-row"><label>Source Name</label><input id="m-name" type="text" value="${existing ? escapeAttr(existing.name) : ''}" /></div>
      <div class="field-row"><label>Local File</label>
        <input id="m-file" type="file" accept=".mp4,.mp3,.webm" />
        <div class="small-note">${existing && existing.file ? 'Current: ' + escapeHtml(existing.file) : 'MP4, MP3, WEBM'}</div>
      </div>
      <div class="checkbox-row"><input type="checkbox" id="m-loop" ${existing && existing.loop ? 'checked' : ''} /> <label for="m-loop">Loop</label></div>
      <div class="field-grid">
        <div class="field-row"><label>Width</label><input id="m-width" type="number" value="${existing ? existing.width : 640}" /></div>
        <div class="field-row"><label>Height</label><input id="m-height" type="number" value="${existing ? existing.height : 360}" /></div>
        <div class="field-row"><label>Position X</label><input id="m-x" type="number" value="${existing ? existing.x : 0}" /></div>
        <div class="field-row"><label>Position Y</label><input id="m-y" type="number" value="${existing ? existing.y : 0}" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">Close</button>
        <button class="btn btn-primary" id="m-save">${isEdit ? 'Save' : 'Add Source'}</button>
      </div>`;
    renderModal(html, async () => {
      const name = document.getElementById('m-name').value.trim();
      if (!name) return alert('Source name is required');
      const fileInput = document.getElementById('m-file');
      let fileName = existing ? existing.file : undefined;
      if (fileInput.files[0]) {
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        const up = await api.post('/api/upload?kind=media', fd);
        fileName = up.file;
      }
      const payload = {
        name, file: fileName,
        loop: document.getElementById('m-loop').checked,
        width: Number(document.getElementById('m-width').value) || 640,
        height: Number(document.getElementById('m-height').value) || 360,
        x: Number(document.getElementById('m-x').value) || 0,
        y: Number(document.getElementById('m-y').value) || 0,
      };
      await saveSource('media', existing, payload);
      closeModal();
    });
  }

  function openTextSourceModal(existing) {
    const isEdit = !!existing;
    const html = `
      <h3>${isEdit ? 'Text Source' : 'Add Text Source'}</h3>
      <div class="field-row"><label>Source Name</label><input id="m-name" type="text" value="${existing ? escapeAttr(existing.name) : ''}" /></div>
      <div class="field-grid">
        <div class="field-row"><label>Font Family</label><input id="m-font" type="text" value="${existing ? escapeAttr(existing.fontFamily) : 'Arial'}" /></div>
        <div class="field-row"><label>Font Size</label><input id="m-size" type="number" value="${existing ? existing.fontSize : 32}" /></div>
      </div>
      <div class="field-row"><label>Text</label><textarea id="m-text" rows="2">${existing ? escapeHtml(existing.text) : ''}</textarea></div>
      <div class="field-row"><label>Color (HEX / RGBA)</label><input id="m-color" type="text" value="${existing ? escapeAttr(existing.color) : '#FFFFFF'}" placeholder="#FFFFFF or rgba(255,255,255,1)" /></div>
      <div class="field-grid">
        <div class="field-row"><label>Position X</label><input id="m-x" type="number" value="${existing ? existing.x : 0}" /></div>
        <div class="field-row"><label>Position Y</label><input id="m-y" type="number" value="${existing ? existing.y : 0}" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">Close</button>
        <button class="btn btn-primary" id="m-save">${isEdit ? 'Save' : 'Add Source'}</button>
      </div>`;
    renderModal(html, async () => {
      const name = document.getElementById('m-name').value.trim();
      if (!name) return alert('Source name is required');
      const payload = {
        name,
        fontFamily: document.getElementById('m-font').value.trim() || 'Arial',
        fontSize: Number(document.getElementById('m-size').value) || 32,
        text: document.getElementById('m-text').value,
        color: document.getElementById('m-color').value.trim() || '#FFFFFF',
        x: Number(document.getElementById('m-x').value) || 0,
        y: Number(document.getElementById('m-y').value) || 0,
        width: existing ? existing.width : 240,
        height: existing ? existing.height : 60,
      };
      await saveSource('text', existing, payload);
      closeModal();
    });
  }

  async function saveSource(type, existing, payload) {
    const scene = activeScene();
    if (existing) {
      await api.put(`/api/scenes/${scene.id}/sources/${existing.id}`, payload);
    } else {
      await api.post(`/api/scenes/${scene.id}/sources`, { type, ...payload });
    }
    await loadScenes();
    renderSources();
    renderWorkspace();
    renderAudioMixer();
  }

  // ================= Workspace (drag/resize) =================
  function renderWorkspace() {
    const ws = document.getElementById('workspace');
    ws.innerHTML = '';
    const scene = activeScene();
    if (!scene) return;
    const rect = ws.getBoundingClientRect();
    const scaleRefWidth = 1920; // sources' x/y/width/height are stored in output-resolution space (default 1920x1080)

    scene.sources.forEach((src) => {
      const el = document.createElement('div');
      el.className = 'ws-source' + (src.id === selectedSourceId ? ' selected' : '') + (!src.shown ? ' hidden-source' : '');
      el.style.left = pct(src.x, scaleRefWidth) + '%';
      el.style.top = pct(src.y, scaleRefWidth * (9 / 16)) + '%';
      el.style.width = pct(src.width, scaleRefWidth) + '%';
      el.style.height = pct(src.height, scaleRefWidth * (9 / 16)) + '%';

      if (src.type === 'text') {
        el.textContent = src.text || src.name;
        el.style.color = src.color && src.color.startsWith('#') ? src.color : '#fff';
      } else if (src.type === 'image' && src.file) {
        el.innerHTML = `<img src="/uploads/${src.file}" draggable="false" />`;
      } else {
        el.textContent = src.name;
      }

      if (!src.locked) {
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        el.appendChild(handle);
        wireResize(handle, el, src, scaleRefWidth);
        wireDrag(el, src, scaleRefWidth);
      }

      el.addEventListener('mousedown', () => { selectedSourceId = src.id; selectedSourceRowId = src.id; renderSources(); renderWorkspace(); });
      ws.appendChild(el);
    });
  }

  function pct(value, ref) { return (value / ref) * 100; }

  function wireDrag(el, src, scaleRefWidth) {
    let dragging = false, startX, startY, origX, origY;
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('resize-handle')) return;
      dragging = true; startX = e.clientX; startY = e.clientY; origX = src.x; origY = src.y;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const ws = document.getElementById('workspace');
      const rect = ws.getBoundingClientRect();
      const dxUnits = ((e.clientX - startX) / rect.width) * scaleRefWidth;
      const dyUnits = ((e.clientY - startY) / rect.height) * (scaleRefWidth * 9 / 16);
      src.x = Math.max(0, Math.round(origX + dxUnits));
      src.y = Math.max(0, Math.round(origY + dyUnits));
      renderWorkspace();
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      updateSource(src.id, { x: src.x, y: src.y });
    });
  }

  function wireResize(handle, el, src, scaleRefWidth) {
    let resizing = false, startX, startY, origW, origH;
    handle.addEventListener('mousedown', (e) => {
      resizing = true; startX = e.clientX; startY = e.clientY; origW = src.width; origH = src.height;
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const ws = document.getElementById('workspace');
      const rect = ws.getBoundingClientRect();
      const dwUnits = ((e.clientX - startX) / rect.width) * scaleRefWidth;
      const dhUnits = ((e.clientY - startY) / rect.height) * (scaleRefWidth * 9 / 16);
      src.width = Math.max(20, Math.round(origW + dwUnits));
      src.height = Math.max(20, Math.round(origH + dhUnits));
      renderWorkspace();
    });
    document.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      updateSource(src.id, { width: src.width, height: src.height });
    });
  }

  function togglePreview() {
    previewOn = !previewOn;
    const btn = document.getElementById('preview-toggle');
    btn.textContent = previewOn ? '✅ Preview' : '⬜ Preview';
    btn.classList.toggle('off', !previewOn);
    document.getElementById('workspace').style.visibility = previewOn ? 'visible' : 'hidden';
  }

  // ================= Audio Mixer =================
  function renderAudioMixer() {
    const list = document.getElementById('audio-mixer-list');
    list.innerHTML = '';
    const scene = activeScene();
    const mediaSources = scene ? scene.sources.filter((s) => s.type === 'media') : [];
    if (!mediaSources.length) {
      list.innerHTML = '<div class="empty-hint">No media sources</div>';
      return;
    }
    mediaSources.forEach((src) => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <span class="name">${escapeHtml(src.name)}</span>
        <input type="range" min="0" max="1.5" step="0.05" value="${src.volume}" style="width:70px" />
        <button class="tiny-btn ${src.muted ? 'on' : ''}" data-act="mute">${src.muted ? '🔇' : '🔊'}</button>
        <button class="tiny-btn" data-act="props" title="Properties">⚙</button>`;
      row.querySelector('input[type="range"]').addEventListener('change', (e) => updateSource(src.id, { volume: Number(e.target.value) }));
      row.querySelector('[data-act="mute"]').addEventListener('click', () => updateSource(src.id, { muted: !src.muted }));
      row.querySelector('[data-act="props"]').addEventListener('click', () => openAudioPropsModal(src));
      list.appendChild(row);
    });
  }

  function openAudioPropsModal(src) {
    const html = `
      <h3>Audio Properties · ${escapeHtml(src.name)}</h3>
      <div class="field-row"><label>Monitor</label>
        <select id="m-monitor">
          <option value="Monitor Off" ${src.monitor === 'Monitor Off' ? 'selected' : ''}>Monitor Off (Output only)</option>
          <option value="Monitor Only" ${src.monitor === 'Monitor Only' ? 'selected' : ''}>Monitor Only (Local use only)</option>
          <option value="Monitor and Output" ${src.monitor === 'Monitor and Output' ? 'selected' : ''}>Monitor and Output (Both)</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">Close</button>
        <button class="btn btn-primary" id="m-save">Save</button>
      </div>`;
    renderModal(html, async () => {
      await updateSource(src.id, { monitor: document.getElementById('m-monitor').value });
      closeModal();
    });
  }

  // ================= Platforms =================
  let selectedPlatformId = null;

  function renderPlatforms() {
    const list = document.getElementById('platform-list');
    list.innerHTML = '';
    if (!platformsData.platforms.length) {
      list.innerHTML = '<div class="empty-hint">No platforms yet — click + to add via Stream Settings</div>';
      return;
    }
    platformsData.platforms.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'list-row' + (p.id === selectedPlatformId ? ' active' : '');
      row.innerHTML = `
        <input type="checkbox" ${p.enabled ? 'checked' : ''} data-act="enable" />
        <span class="name">${escapeHtml(p.label)}</span>
        <button class="tiny-btn" data-act="edit" title="Edit">✏️</button>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        selectedPlatformId = p.id;
        renderPlatforms();
      });
      row.querySelector('[data-act="enable"]').addEventListener('change', async (e) => {
        await api.put(`/api/settings/platforms/${p.id}`, { enabled: e.target.checked });
        await loadPlatforms();
        renderPlatforms();
      });
      row.querySelector('[data-act="edit"]').addEventListener('click', () => showView('settings-stream'));
      list.appendChild(row);
    });
  }

  async function onRemoveSelectedPlatform() {
    if (!selectedPlatformId) return alert('Select a platform first');
    if (!confirm('Remove this platform? (Its stream service in Settings → Stream will also be removed.)')) return;
    const plat = platformsData.platforms.find((p) => p.id === selectedPlatformId);
    if (plat && plat.serviceId) {
      await api.del(`/api/settings/stream/services/${plat.serviceId}`);
    } else {
      await api.del(`/api/settings/platforms/${selectedPlatformId}`);
    }
    selectedPlatformId = null;
    await loadPlatforms();
    renderPlatforms();
  }

  // ================= Controls / Status =================
  async function onStartStreaming() {
    document.getElementById('stream-error').textContent = '';
    try {
      await api.post('/api/stream/start');
    } catch (e) {
      document.getElementById('stream-error').textContent = e.message;
    }
  }
  async function onEndStreaming() {
    await api.post('/api/stream/stop');
  }

  function applyStatus(status) {
    currentStreamStatus = status;
    const pill = document.getElementById('status-text');
    pill.className = 'status-pill ' + status.status;
    pill.textContent = status.status.charAt(0).toUpperCase() + status.status.slice(1);

    const startBtn = document.getElementById('start-streaming-btn');
    const endBtn = document.getElementById('end-streaming-btn');
    const live = status.status === 'live' || status.status === 'starting';
    startBtn.classList.toggle('hidden', live);
    endBtn.classList.toggle('hidden', !live);

    if (status.status === 'error' && status.lastError) {
      document.getElementById('stream-error').textContent = status.lastError;
    }
    tickUptime();
  }

  function tickUptime() {
    const el = document.getElementById('status-uptime');
    const s = currentStreamStatus.uptimeSeconds || 0;
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = `${hh}:${mm}:${ss}`;
    if (currentStreamStatus.status === 'live') currentStreamStatus.uptimeSeconds = s + 1;
  }

  // ================= Modal helpers =================
  function renderModal(innerHtml, onSave) {
    const overlay = document.getElementById('modal-overlay');
    const root = document.getElementById('modal-root');
    overlay.classList.remove('hidden');
    root.classList.remove('hidden');
    root.innerHTML = `<div class="modal-card">${innerHtml}</div>`;
    root.querySelector('#m-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal, { once: true });
    root.querySelector('#m-save').addEventListener('click', async () => {
      const err = await onSave();
      if (err) alert(err);
    });
  }
  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-root').classList.add('hidden');
    document.getElementById('modal-root').innerHTML = '';
  }
  function openPromptModal(title, label, value, onSave) {
    const html = `
      <h3>${title}</h3>
      <div class="field-row"><label>${label}</label><input id="m-input" type="text" value="${escapeAttr(value)}" /></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">Close</button>
        <button class="btn btn-primary" id="m-save">Add Scene</button>
      </div>`;
    renderModal(html, async () => {
      const err = await onSave(document.getElementById('m-input').value);
      if (!err) closeModal();
      return err;
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  return { init, refreshAll, applyStatus };
})();

window.EditorModule = EditorModule;
