const Editor = (() => {
  const LOGICAL_W = 1280, LOGICAL_H = 720; // workspace logical coordinate space (scaled to real output res at stream time)
  const state = { scenes: [], activeSceneId: null, selectedSourceId: null, selectedSceneId: null, platforms: [] };
  let previewEnabled = true;

  function modalRoot() { return document.getElementById('modal-root'); }
  function openModal(innerHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${innerHtml}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    modalRoot().appendChild(overlay);
    return overlay;
  }
  function closeModal() { modalRoot().innerHTML = ''; }

  // ---------------- data loading ----------------
  async function loadAll() {
    const [scenesRes, platformsRes] = await Promise.all([Api.getScenes(), Api.getPlatforms()]);
    state.scenes = scenesRes.scenes;
    state.activeSceneId = scenesRes.activeSceneId;
    state.platforms = platformsRes.platforms;
    renderAll();
  }
  function renderAll() {
    renderSceneList(); renderSourceList(); renderWorkspace(); renderAudioMixer(); renderPlatformList();
  }
  function getActiveScene() { return state.scenes.find(s => s.id === state.activeSceneId); }

  // ---------------- scenes ----------------
  function renderSceneList() {
    const ul = document.getElementById('scene-list');
    ul.innerHTML = '';
    state.scenes.forEach((scene, i) => {
      const li = document.createElement('li');
      if (scene.id === state.activeSceneId) li.classList.add('active');
      li.innerHTML = `
        <span class="name">${escapeHtml(scene.name)}</span>
        <span class="row-actions">
          <button title="Move Up" data-scene-move="up">&#8593;</button>
          <button title="Move Down" data-scene-move="down">&#8595;</button>
          <button title="Properties" data-scene-props>&#9998;</button>
        </span>`;
      li.querySelector('.name').addEventListener('click', () => activateScene(scene.id));
      li.addEventListener('click', () => { state.selectedSceneId = scene.id; renderSceneList(); }, true);
      li.querySelector('[data-scene-move="up"]').addEventListener('click', e => { e.stopPropagation(); moveScene(scene.id, 'up'); });
      li.querySelector('[data-scene-move="down"]').addEventListener('click', e => { e.stopPropagation(); moveScene(scene.id, 'down'); });
      li.querySelector('[data-scene-props]').addEventListener('click', e => { e.stopPropagation(); openRenameSceneModal(scene); });
      ul.appendChild(li);
    });
  }
  async function activateScene(id) {
    await Api.activateScene(id);
    state.activeSceneId = id;
    state.selectedSourceId = null;
    renderAll();
  }
  async function moveScene(id, direction) {
    const r = await Api.moveScene(id, direction);
    state.scenes = r.scenes;
    renderSceneList();
  }
  function openAddSceneModal() {
    const overlay = openModal(`
      <h3>Add Scene</h3>
      <label>Enter scene name<input id="new-scene-name" type="text" autofocus></label>
      <p class="error-text" id="new-scene-error"></p>
      <div class="modal-actions">
        <button class="btn" id="scene-modal-close">Close</button>
        <button class="btn primary" id="scene-modal-add">Add Scene</button>
      </div>`);
    overlay.querySelector('#scene-modal-close').onclick = closeModal;
    overlay.querySelector('#scene-modal-add').onclick = async () => {
      const name = overlay.querySelector('#new-scene-name').value.trim();
      if (!name) return;
      try {
        const r = await Api.addScene(name);
        state.scenes.push(r.scene);
        if (!state.activeSceneId) state.activeSceneId = r.scene.id;
        closeModal(); renderAll();
      } catch (e) { overlay.querySelector('#new-scene-error').textContent = e.message; }
    };
  }
  function openRenameSceneModal(scene) {
    const overlay = openModal(`
      <h3>Scene Properties</h3>
      <label>Scene name<input id="rename-scene-name" type="text" value="${escapeHtml(scene.name)}"></label>
      <p class="error-text" id="rename-scene-error"></p>
      <div class="modal-actions">
        <button class="btn" id="scene-modal-close">Close</button>
        <button class="btn primary" id="scene-modal-save">Save</button>
      </div>`);
    overlay.querySelector('#scene-modal-close').onclick = closeModal;
    overlay.querySelector('#scene-modal-save').onclick = async () => {
      const name = overlay.querySelector('#rename-scene-name').value.trim();
      if (!name) return;
      try {
        const r = await Api.updateScene(scene.id, { name });
        Object.assign(scene, r.scene);
        closeModal(); renderSceneList();
      } catch (e) { overlay.querySelector('#rename-scene-error').textContent = e.message; }
    };
  }
  async function removeSelectedScene() {
    const id = state.selectedSceneId || state.activeSceneId;
    if (!id) return;
    if (!confirm('Remove this scene?')) return;
    await Api.removeScene(id);
    state.scenes = state.scenes.filter(s => s.id !== id);
    if (state.activeSceneId === id) state.activeSceneId = state.scenes[0] ? state.scenes[0].id : null;
    renderAll();
  }

  // ---------------- sources ----------------
  function renderSourceList() {
    const ul = document.getElementById('source-list');
    ul.innerHTML = '';
    const scene = getActiveScene();
    if (!scene) return;
    scene.sources.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(src => {
      const li = document.createElement('li');
      if (src.id === state.selectedSourceId) li.classList.add('active');
      li.innerHTML = `
        <span class="name">${iconFor(src.type)} ${escapeHtml(src.name)}</span>
        <span class="row-actions">
          <button title="Lock/Unlock" data-act="lock">${src.locked ? '&#128274;' : '&#128275;'}</button>
          <button title="Show/UnShow" data-act="show">${src.visible !== false ? '&#128065;' : '&#128584;'}</button>
          <button title="Move Up" data-act="up">&#8593;</button>
          <button title="Move Down" data-act="down">&#8595;</button>
          <button title="Properties" data-act="props">&#9998;</button>
        </span>`;
      li.querySelector('.name').addEventListener('click', () => { state.selectedSourceId = src.id; renderSourceList(); renderWorkspace(); });
      li.querySelector('[data-act="lock"]').addEventListener('click', async e => { e.stopPropagation(); await updateSource(scene, src, { locked: !src.locked }); });
      li.querySelector('[data-act="show"]').addEventListener('click', async e => { e.stopPropagation(); await updateSource(scene, src, { visible: !(src.visible !== false) }); });
      li.querySelector('[data-act="up"]').addEventListener('click', async e => { e.stopPropagation(); await moveSource(scene, src, 'up'); });
      li.querySelector('[data-act="down"]').addEventListener('click', async e => { e.stopPropagation(); await moveSource(scene, src, 'down'); });
      li.querySelector('[data-act="props"]').addEventListener('click', e => { e.stopPropagation(); openEditSourceModal(scene, src); });
      ul.appendChild(li);
    });
  }
  function iconFor(type) { return { image: '&#128444;', media: '&#127909;', text: '&#128221;' }[type] || '&#8226;'; }

  async function updateSource(scene, src, patch) {
    const r = await Api.updateSource(scene.id, src.id, patch);
    Object.assign(src, r.source);
    renderSourceList(); renderWorkspace(); renderAudioMixer();
  }
  async function moveSource(scene, src, direction) {
    const r = await Api.moveSource(scene.id, src.id, direction);
    scene.sources = r.sources;
    renderSourceList(); renderWorkspace();
  }
  async function removeSelectedSource() {
    const scene = getActiveScene();
    if (!scene || !state.selectedSourceId) return;
    if (!confirm('Remove this source?')) return;
    await Api.removeSource(scene.id, state.selectedSourceId);
    scene.sources = scene.sources.filter(s => s.id !== state.selectedSourceId);
    state.selectedSourceId = null;
    renderSourceList(); renderWorkspace(); renderAudioMixer();
  }

  function openAddSourceModal() {
    const overlay = openModal(`
      <h3>Add Source</h3>
      <label>Source type
        <select id="new-source-type">
          <option value="image">Image</option>
          <option value="media">Media</option>
          <option value="text">Text</option>
        </select>
      </label>
      <div id="new-source-fields"></div>
      <div class="modal-actions">
        <button class="btn" id="src-modal-close">Close</button>
        <button class="btn primary" id="src-modal-add">Add Source</button>
      </div>`);
    const fieldsEl = overlay.querySelector('#new-source-fields');
    const typeSel = overlay.querySelector('#new-source-type');
    const renderFields = () => { fieldsEl.innerHTML = sourceFormHtml(typeSel.value, {}); };
    typeSel.addEventListener('change', renderFields);
    renderFields();
    overlay.querySelector('#src-modal-close').onclick = closeModal;
    overlay.querySelector('#src-modal-add').onclick = async () => {
      const scene = getActiveScene();
      if (!scene) return closeModal();
      const type = typeSel.value;
      const body = await collectSourceForm(overlay, type, {});
      if (!body) return;
      const r = await Api.addSource(scene.id, body);
      scene.sources.push(r.source);
      closeModal(); renderSourceList(); renderWorkspace(); renderAudioMixer();
    };
  }

  function openEditSourceModal(scene, src) {
    const overlay = openModal(`
      <h3>Source Properties &mdash; ${escapeHtml(src.type)}</h3>
      <div id="edit-source-fields">${sourceFormHtml(src.type, src)}</div>
      <div class="modal-actions">
        <button class="btn" id="src-modal-close">Close</button>
        <button class="btn primary" id="src-modal-save">Save</button>
      </div>`);
    overlay.querySelector('#src-modal-close').onclick = closeModal;
    overlay.querySelector('#src-modal-save').onclick = async () => {
      const body = await collectSourceForm(overlay, src.type, src);
      if (!body) return;
      await updateSource(scene, src, body);
      closeModal();
    };
  }

  function sourceFormHtml(type, src) {
    const name = src.name || '';
    if (type === 'image') {
      return `
        <label>Source Name<input id="f-name" type="text" value="${escapeHtml(name)}"></label>
        <label>Image File (PNG, JPG, JPEG, GIF, TGA, BMP)<input id="f-file" type="file" accept=".png,.jpg,.jpeg,.gif,.tga,.bmp"></label>
        <div class="progress"><div class="progress-fill" id="f-progress"></div></div>
        <div class="field-row">
          <label>Width<input id="f-width" type="number" value="${src.width || 320}"></label>
          <label>Height<input id="f-height" type="number" value="${src.height || 240}"></label>
        </div>
        <div class="field-row">
          <label>Position X<input id="f-x" type="number" value="${src.x || 0}"></label>
          <label>Position Y<input id="f-y" type="number" value="${src.y || 0}"></label>
        </div>`;
    }
    if (type === 'media') {
      return `
        <label>Source Name<input id="f-name" type="text" value="${escapeHtml(name)}"></label>
        <label>Local File (MP4, MP3, WEBM)<input id="f-file" type="file" accept=".mp4,.mp3,.webm"></label>
        <div class="progress"><div class="progress-fill" id="f-progress"></div></div>
        <label style="flex-direction:row;align-items:center;gap:8px;"><input id="f-loop" type="checkbox" ${src.loop ? 'checked' : ''}> Loop</label>
        <div class="field-row">
          <label>Width<input id="f-width" type="number" value="${src.width || 640}"></label>
          <label>Height<input id="f-height" type="number" value="${src.height || 360}"></label>
        </div>
        <div class="field-row">
          <label>Position X<input id="f-x" type="number" value="${src.x || 0}"></label>
          <label>Position Y<input id="f-y" type="number" value="${src.y || 0}"></label>
        </div>`;
    }
    // text
    return `
      <label>Source Name<input id="f-name" type="text" value="${escapeHtml(name)}"></label>
      <label>Font Family<input id="f-font" type="text" value="${escapeHtml(src.fontFamily || 'Sans')}"></label>
      <label>Font Size<input id="f-fontsize" type="number" value="${src.fontSize || 32}"></label>
      <label>Text<textarea id="f-text" rows="3">${escapeHtml(src.text || '')}</textarea></label>
      <label>Color (HEX / RGBA / HSV name)<input id="f-color" type="text" value="${escapeHtml(src.color || '#ffffff')}"></label>
      <div class="field-row">
        <label>Position X<input id="f-x" type="number" value="${src.x || 0}"></label>
        <label>Position Y<input id="f-y" type="number" value="${src.y || 0}"></label>
      </div>`;
  }

  async function collectSourceForm(overlay, type, existing) {
    const name = overlay.querySelector('#f-name').value.trim() || `${type}-source`;
    const body = { name, type };
    if (type === 'image' || type === 'media') {
      body.width = Number(overlay.querySelector('#f-width').value) || 100;
      body.height = Number(overlay.querySelector('#f-height').value) || 100;
      body.x = Number(overlay.querySelector('#f-x').value) || 0;
      body.y = Number(overlay.querySelector('#f-y').value) || 0;
      if (type === 'media') body.loop = overlay.querySelector('#f-loop').checked;
      const fileInput = overlay.querySelector('#f-file');
      if (fileInput.files && fileInput.files[0]) {
        const progressEl = overlay.querySelector('#f-progress');
        const r = await Api.upload('/api/upload', fileInput.files[0], pct => { if (progressEl) progressEl.style.width = pct + '%'; });
        body.file = r.file;
        if (type === 'media') {
          const ext = fileInput.files[0].name.split('.').pop().toLowerCase();
          body.hasAudio = true;
          body.hasVideo = ext !== 'mp3';
        }
      } else if (existing.file) {
        body.file = existing.file;
        if (type === 'media') { body.hasAudio = existing.hasAudio; body.hasVideo = existing.hasVideo; }
      } else {
        alert('Please choose a file.'); return null;
      }
    } else {
      body.fontFamily = overlay.querySelector('#f-font').value.trim() || 'Sans';
      body.fontSize = Number(overlay.querySelector('#f-fontsize').value) || 32;
      body.text = overlay.querySelector('#f-text').value;
      body.color = overlay.querySelector('#f-color').value.trim() || '#ffffff';
      body.x = Number(overlay.querySelector('#f-x').value) || 0;
      body.y = Number(overlay.querySelector('#f-y').value) || 0;
      body.width = 200; body.height = (body.fontSize || 32) + 10;
    }
    return body;
  }

  // ---------------- workspace (drag/resize) ----------------
  function renderWorkspace() {
    const ws = document.getElementById('workspace');
    ws.innerHTML = '';
    const scene = getActiveScene();
    if (!scene) return;
    const rect = ws.getBoundingClientRect();
    const scale = rect.width / LOGICAL_W;
    scene.sources.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(src => {
      if (src.visible === false) return;
      const el = document.createElement('div');
      el.className = 'ws-source' + (src.id === state.selectedSourceId ? ' selected' : '') + (src.locked ? ' locked' : '') + (src.type === 'text' ? ' text-source' : '');
      el.style.left = (src.x * scale) + 'px';
      el.style.top = (src.y * scale) + 'px';
      el.style.width = (src.width * scale) + 'px';
      el.style.height = (src.height * scale) + 'px';
      if (src.type === 'image' && src.file) {
        el.innerHTML = `<img src="/uploads/${src.file}" draggable="false">`;
      } else if (src.type === 'media' && src.file) {
        if (src.hasVideo === false) {
          el.style.background = '#222'; el.textContent = '\u266B ' + src.name;
        } else {
          el.innerHTML = `<video src="/uploads/${src.file}" muted loop playsinline></video>`;
        }
      } else if (src.type === 'text') {
        el.textContent = src.text || '';
        el.style.color = src.color || '#fff';
        el.style.fontSize = Math.max(8, (src.fontSize || 32) * scale) + 'px';
        el.style.fontFamily = src.fontFamily || 'sans-serif';
      }
      if (!src.locked) {
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        el.appendChild(handle);
        wireDragResize(el, handle, src, scene, scale);
      }
      el.addEventListener('mousedown', () => { state.selectedSourceId = src.id; renderSourceList(); renderWorkspace(); });
      ws.appendChild(el);
    });
  }

  function wireDragResize(el, handle, src, scene, scale) {
    let mode = null, startX, startY, orig;
    el.addEventListener('mousedown', e => {
      if (e.target === handle) return;
      mode = 'move'; startX = e.clientX; startY = e.clientY;
      orig = { x: src.x, y: src.y };
      e.preventDefault();
    });
    handle.addEventListener('mousedown', e => {
      mode = 'resize'; startX = e.clientX; startY = e.clientY;
      orig = { width: src.width, height: src.height };
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', e => {
      if (!mode) return;
      const dx = (e.clientX - startX) / scale, dy = (e.clientY - startY) / scale;
      if (mode === 'move') {
        src.x = Math.round(orig.x + dx); src.y = Math.round(orig.y + dy);
        el.style.left = (src.x * scale) + 'px'; el.style.top = (src.y * scale) + 'px';
      } else if (mode === 'resize') {
        src.width = Math.max(20, Math.round(orig.width + dx));
        src.height = Math.max(20, Math.round(orig.height + dy));
        el.style.width = (src.width * scale) + 'px'; el.style.height = (src.height * scale) + 'px';
      }
    });
    window.addEventListener('mouseup', () => {
      if (!mode) return;
      const patch = mode === 'move' ? { x: src.x, y: src.y } : { width: src.width, height: src.height };
      mode = null;
      Api.updateSource(scene.id, src.id, patch).catch(() => {});
    });
  }

  function togglePreview() {
    previewEnabled = !previewEnabled;
    document.getElementById('workspace').style.visibility = previewEnabled ? 'visible' : 'hidden';
    document.getElementById('preview-toggle').style.opacity = previewEnabled ? '1' : '.4';
  }

  // ---------------- audio mixer ----------------
  function renderAudioMixer() {
    const ul = document.getElementById('audio-mixer-list');
    ul.innerHTML = '';
    const scene = getActiveScene();
    if (!scene) return;
    scene.sources.filter(s => s.type === 'media' && s.hasAudio !== false).forEach(src => {
      const li = document.createElement('li');
      li.className = 'mixer-row';
      li.innerHTML = `
        <div class="mixer-top">
          <span>${escapeHtml(src.name)}</span>
          <button title="Mute/Unmute" data-act="mute">${src.muted ? '&#128263;' : '&#128266;'}</button>
        </div>
        <input type="range" min="0" max="1.5" step="0.05" value="${typeof src.volume === 'number' ? src.volume : 1}">`;
      li.querySelector('input[type=range]').addEventListener('change', async e => {
        await updateSource(scene, src, { volume: Number(e.target.value) });
      });
      li.querySelector('[data-act="mute"]').addEventListener('click', async () => {
        await updateSource(scene, src, { muted: !src.muted });
      });
      ul.appendChild(li);
    });
  }

  // ---------------- platforms ----------------
  function renderPlatformList() {
    const ul = document.getElementById('platform-list');
    ul.innerHTML = '';
    state.platforms.forEach(p => {
      const li = document.createElement('li');
      if (p.id === state.selectedPlatformId) li.classList.add('active');
      li.innerHTML = `
        <input type="checkbox" ${p.enabled ? 'checked' : ''} title="Enable/Disable">
        <span class="name">${escapeHtml(p.name || p.service)}</span>
        <span class="row-actions"><button title="Edit">&#9998;</button></span>`;
      li.addEventListener('click', () => { state.selectedPlatformId = p.id; renderPlatformList(); });
      li.querySelector('input[type=checkbox]').addEventListener('click', async e => {
        e.stopPropagation();
        await Api.updatePlatform(p.id, { enabled: e.target.checked });
        p.enabled = e.target.checked;
      });
      li.querySelector('button').addEventListener('click', e => {
        e.stopPropagation();
        window.editingPlatformId = p.id;
        App.navigate('settings/stream');
      });
      ul.appendChild(li);
    });
  }
  async function removeSelectedPlatform() {
    if (!state.selectedPlatformId) return;
    if (!confirm('Remove this platform?')) return;
    await Api.removePlatform(state.selectedPlatformId);
    state.platforms = state.platforms.filter(p => p.id !== state.selectedPlatformId);
    state.selectedPlatformId = null;
    renderPlatformList();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function wireToolbars() {
    document.querySelector('[data-action="add-scene"]').addEventListener('click', openAddSceneModal);
    document.querySelector('[data-action="remove-scene"]').addEventListener('click', removeSelectedScene);
    document.querySelector('[data-action="add-source"]').addEventListener('click', () => {
      if (!getActiveScene()) return alert('Create a scene first.');
      openAddSourceModal();
    });
    document.querySelector('[data-action="remove-source"]').addEventListener('click', removeSelectedSource);
    document.querySelector('[data-action="add-platform"]').addEventListener('click', () => {
      window.editingPlatformId = null;
      App.navigate('settings/stream');
    });
    document.querySelector('[data-action="remove-platform"]').addEventListener('click', removeSelectedPlatform);
    document.getElementById('preview-toggle').addEventListener('click', togglePreview);
    window.addEventListener('resize', renderWorkspace);
  }

  return { loadAll, renderAll, wireToolbars, getState: () => state };
})();
