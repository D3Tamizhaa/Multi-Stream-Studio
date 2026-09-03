// Editor page: Scenes / Sources / Audio Mixer / Platforms / Controls / Usage.
const EditorState = {
  scenes: [],
  activeSceneId: null,
  selectedSceneId: null,
  sources: [],
  selectedSourceId: null,
  platforms: [],
  selectedPlatformId: null,
  editingPlatformId: null
};

function showModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
  });
  return root.querySelector('.modal');
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

// ---------------------------------------------------------------- Scenes
async function loadScenes() {
  const data = await API.get('/api/scenes');
  EditorState.scenes = data.scenes;
  EditorState.activeSceneId = data.activeSceneId;
  if (!EditorState.selectedSceneId) EditorState.selectedSceneId = data.activeSceneId;
  renderSceneList();
  await loadSources();
}

function renderSceneList() {
  const list = document.getElementById('scene-list');
  list.innerHTML = '';
  if (EditorState.scenes.length === 0) {
    list.innerHTML = '<li class="panel-empty">No scenes yet</li>';
    return;
  }
  EditorState.scenes.forEach((scene) => {
    const li = document.createElement('li');
    li.className = 'selectable' + (scene.id === EditorState.selectedSceneId ? ' active' : '');
    li.innerHTML = `
      <span class="item-name" title="${scene.name}">${scene.name}${scene.id === EditorState.activeSceneId ? ' \u25CF' : ''}</span>
      <span class="row-actions">
        <button class="btn-icon btn-sm" data-act="up" title="Move Up">&uarr;</button>
        <button class="btn-icon btn-sm" data-act="down" title="Move Down">&darr;</button>
        <button class="btn-icon btn-sm" data-act="props" title="Properties">&#9998;</button>
      </span>`;
    li.querySelector('.item-name').addEventListener('click', async () => {
      EditorState.selectedSceneId = scene.id;
      await API.post(`/api/scenes/${scene.id}/activate`);
      await loadScenes();
    });
    li.querySelector('[data-act="up"]').addEventListener('click', async () => { await API.post(`/api/scenes/${scene.id}/move`, { direction: 'up' }); loadScenes(); });
    li.querySelector('[data-act="down"]').addEventListener('click', async () => { await API.post(`/api/scenes/${scene.id}/move`, { direction: 'down' }); loadScenes(); });
    li.querySelector('[data-act="props"]').addEventListener('click', async () => {
      const name = prompt('Scene name', scene.name);
      if (name && name.trim()) {
        try { await API.post(`/api/scenes/${scene.id}/rename`, { name: name.trim() }); loadScenes(); }
        catch (err) { alert(err.message); }
      }
    });
    list.appendChild(li);
  });
}

document.getElementById('scene-add-btn').addEventListener('click', () => {
  const name = prompt('Enter scene name');
  if (!name || !name.trim()) return;
  API.post('/api/scenes', { name: name.trim() })
    .then(loadScenes)
    .catch((err) => alert(err.message));
});

document.getElementById('scene-remove-btn').addEventListener('click', async () => {
  if (!EditorState.selectedSceneId) return;
  if (!confirm('Remove this scene and all of its sources?')) return;
  try { await API.del(`/api/scenes/${EditorState.selectedSceneId}`); EditorState.selectedSceneId = null; loadScenes(); }
  catch (err) { alert(err.message); }
});

// ---------------------------------------------------------------- Sources
async function loadSources() {
  const sceneId = EditorState.activeSceneId;
  const data = await API.get(`/api/sources?sceneId=${sceneId}`);
  EditorState.sources = data.sources;
  renderSourceList();
  renderMixer();
  Workspace.render(EditorState.sources);
}

function renderSourceList() {
  const list = document.getElementById('source-list');
  list.innerHTML = '';
  if (EditorState.sources.length === 0) {
    list.innerHTML = '<li class="panel-empty">No sources in this scene</li>';
    return;
  }
  EditorState.sources.forEach((src) => {
    const li = document.createElement('li');
    li.className = 'selectable' + (src.id === EditorState.selectedSourceId ? ' active' : '');
    li.innerHTML = `
      <span class="item-name" title="${src.name}">${src.name}</span>
      <span class="row-actions">
        <button class="btn-icon btn-sm" data-act="lock" title="Lock/Unlock">${src.locked ? '&#128274;' : '&#128275;'}</button>
        <button class="btn-icon btn-sm" data-act="show" title="Show/Hide">${src.visible !== false ? '&#128065;' : '&#128683;'}</button>
        <button class="btn-icon btn-sm" data-act="up" title="Move Up">&uarr;</button>
        <button class="btn-icon btn-sm" data-act="down" title="Move Down">&darr;</button>
        <button class="btn-icon btn-sm" data-act="props" title="Properties">&#9998;</button>
      </span>`;
    li.querySelector('.item-name').addEventListener('click', () => {
      EditorState.selectedSourceId = src.id;
      Workspace.select(src.id);
      renderSourceList();
      Workspace.render(EditorState.sources);
    });
    li.querySelector('[data-act="lock"]').addEventListener('click', async () => { await API.patch(`/api/sources/${src.id}`, { locked: !src.locked }); loadSources(); });
    li.querySelector('[data-act="show"]').addEventListener('click', async () => { await API.patch(`/api/sources/${src.id}`, { visible: src.visible === false }); loadSources(); });
    li.querySelector('[data-act="up"]').addEventListener('click', async () => { await API.post(`/api/sources/${src.id}/move`, { direction: 'up' }); loadSources(); });
    li.querySelector('[data-act="down"]').addEventListener('click', async () => { await API.post(`/api/sources/${src.id}/move`, { direction: 'down' }); loadSources(); });
    li.querySelector('[data-act="props"]').addEventListener('click', () => openSourceModal(src));
    list.appendChild(li);
  });
}

document.getElementById('source-remove-btn').addEventListener('click', async () => {
  if (!EditorState.selectedSourceId) return;
  if (!confirm('Remove this source?')) return;
  await API.del(`/api/sources/${EditorState.selectedSourceId}`);
  EditorState.selectedSourceId = null;
  loadSources();
});

Workspace.onSelect = (id) => { EditorState.selectedSourceId = id; renderSourceList(); };
document.addEventListener('workspace:rerender', () => Workspace.render(EditorState.sources));

function openSourceModal(existing) {
  const type = existing ? existing.type : 'image';
  const modal = showModal(sourceModalHtml(type, existing));
  wireSourceModal(modal, type, existing);
}

document.getElementById('source-add-btn').addEventListener('click', () => openSourceModal(null));

function sourceModalHtml(type, existing) {
  const tabs = ['image', 'media', 'text'].map((t) =>
    `<button type="button" data-tab="${t}" class="${t === type ? 'active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  return `
    <h3>${existing ? 'Source Properties' : 'Add Source'}</h3>
    <div class="tabs" id="source-tabs" ${existing ? 'style="display:none"' : ''}>${tabs}</div>
    <form id="source-form">
      <div class="field-row"><label>Source Name <input type="text" id="src-name" value="${existing ? existing.name : ''}" required></label></div>
      <div id="source-type-fields"></div>
      <p id="source-error" class="error-text" hidden></p>
      <div class="actions">
        <button type="button" class="btn" id="source-cancel-btn">Close</button>
        <button type="submit" class="btn btn-primary">${existing ? 'Save' : 'Add Source'}</button>
      </div>
    </form>`;
}

function typeFieldsHtml(type, existing) {
  if (type === 'image') {
    return `
      <div class="field-row"><label>Image File <input type="file" id="src-file" accept=".png,.jpg,.jpeg,.gif,.tga,.bmp" ${existing ? '' : 'required'}></label></div>
      <div class="progress-bar" id="src-progress" hidden><div class="fill"></div></div>
      <div class="two-col">
        <label>Width <input type="number" id="src-width" value="${existing ? existing.width : 320}"></label>
        <label>Height <input type="number" id="src-height" value="${existing ? existing.height : 180}"></label>
      </div>
      <div class="two-col">
        <label>Position X <input type="number" id="src-x" value="${existing ? existing.x : 0}"></label>
        <label>Position Y <input type="number" id="src-y" value="${existing ? existing.y : 0}"></label>
      </div>`;
  }
  if (type === 'media') {
    return `
      <div class="field-row"><label>Local File <input type="file" id="src-file" accept=".mp4,.mp3,.webm" ${existing ? '' : 'required'}></label></div>
      <div class="progress-bar" id="src-progress" hidden><div class="fill"></div></div>
      <div class="field-row"><label style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" id="src-loop" ${existing && existing.loop ? 'checked' : ''} style="width:auto;"> Loop</label></div>
      <div class="two-col">
        <label>Width <input type="number" id="src-width" value="${existing ? existing.width : 320}"></label>
        <label>Height <input type="number" id="src-height" value="${existing ? existing.height : 180}"></label>
      </div>
      <div class="two-col">
        <label>Position X <input type="number" id="src-x" value="${existing ? existing.x : 0}"></label>
        <label>Position Y <input type="number" id="src-y" value="${existing ? existing.y : 0}"></label>
      </div>`;
  }
  return `
    <div class="field-row"><label>Font Family <input type="text" id="src-font" value="${existing ? existing.fontFamily : 'DejaVuSans-Bold'}"></label></div>
    <div class="field-row"><label>Font Size <input type="number" id="src-fontsize" value="${existing ? existing.fontSize : 32}"></label></div>
    <div class="field-row"><label>Text <textarea id="src-text" rows="2">${existing ? (existing.text || '') : ''}</textarea></label></div>
    <div class="field-row"><label>Color <input type="color" id="src-color" value="${existing ? (existing.color || '#ffffff') : '#ffffff'}"></label></div>
    <div class="two-col">
      <label>Position X <input type="number" id="src-x" value="${existing ? existing.x : 0}"></label>
      <label>Position Y <input type="number" id="src-y" value="${existing ? existing.y : 0}"></label>
    </div>`;
}

function wireSourceModal(modal, initialType, existing) {
  let currentType = initialType;
  const fieldsEl = modal.querySelector('#source-type-fields');
  fieldsEl.innerHTML = typeFieldsHtml(currentType, existing);

  modal.querySelectorAll('#source-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.tab;
      modal.querySelectorAll('#source-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
      fieldsEl.innerHTML = typeFieldsHtml(currentType, null);
    });
  });

  modal.querySelector('#source-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#source-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = modal.querySelector('#source-error');
    errorEl.hidden = true;
    const name = modal.querySelector('#src-name').value.trim();
    try {
      let fileName = existing ? existing.file : undefined;
      if (currentType !== 'text') {
        const fileInput = modal.querySelector('#src-file');
        if (fileInput && fileInput.files[0]) {
          fileName = await uploadFile(fileInput.files[0], modal.querySelector('#src-progress'));
        }
      }
      const payload = {
        name,
        x: Number(modal.querySelector('#src-x').value) || 0,
        y: Number(modal.querySelector('#src-y').value) || 0
      };
      if (currentType === 'image') {
        payload.file = fileName;
        payload.width = Number(modal.querySelector('#src-width').value) || 320;
        payload.height = Number(modal.querySelector('#src-height').value) || 180;
      } else if (currentType === 'media') {
        payload.file = fileName;
        payload.loop = modal.querySelector('#src-loop').checked;
        payload.width = Number(modal.querySelector('#src-width').value) || 320;
        payload.height = Number(modal.querySelector('#src-height').value) || 180;
      } else {
        payload.fontFamily = modal.querySelector('#src-font').value;
        payload.fontSize = Number(modal.querySelector('#src-fontsize').value) || 32;
        payload.text = modal.querySelector('#src-text').value;
        payload.color = modal.querySelector('#src-color').value;
      }

      if (existing) {
        await API.patch(`/api/sources/${existing.id}`, payload);
      } else {
        payload.sceneId = EditorState.activeSceneId;
        payload.type = currentType;
        await API.post('/api/sources', payload);
      }
      closeModal();
      loadSources();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

function uploadFile(file, progressEl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/sources/upload');
    if (progressEl) progressEl.hidden = false;
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && progressEl) {
        progressEl.querySelector('.fill').style.width = `${Math.round((e.loaded / e.total) * 100)}%`;
      }
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText).file);
      } else {
        reject(new Error('Upload failed.'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed.'));
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

// ---------------------------------------------------------------- Audio Mixer
function renderMixer() {
  const container = document.getElementById('mixer-strips');
  const mediaSources = EditorState.sources.filter((s) => s.type === 'media');
  if (mediaSources.length === 0) {
    container.innerHTML = '<p class="panel-empty">No media sources</p>';
    return;
  }
  container.innerHTML = '';
  mediaSources.forEach((src) => {
    const strip = document.createElement('div');
    strip.className = 'mixer-strip';
    strip.innerHTML = `
      <div class="mixer-name">
        <span>${src.name}</span>
        <button class="btn-icon btn-sm" data-act="mute" title="Mute/Unmute (local only)">${src.muted ? '&#128263;' : '&#128266;'}</button>
      </div>
      <input type="range" min="0" max="1.5" step="0.01" value="${src.volume === undefined ? 1 : src.volume}">`;
    strip.querySelector('input[type=range]').addEventListener('change', async (e) => {
      await API.patch(`/api/sources/${src.id}`, { volume: Number(e.target.value) });
    });
    strip.querySelector('[data-act="mute"]').addEventListener('click', async () => {
      await API.patch(`/api/sources/${src.id}`, { muted: !src.muted });
      loadSources();
    });
    container.appendChild(strip);
  });
}

// ---------------------------------------------------------------- Platforms
async function loadPlatforms() {
  const data = await API.get('/api/platforms');
  EditorState.platforms = data.platforms;
  renderPlatformList();
}

function renderPlatformList() {
  const list = document.getElementById('platform-list');
  list.innerHTML = '';
  if (EditorState.platforms.length === 0) {
    list.innerHTML = '<li class="panel-empty">No platforms added</li>';
    return;
  }
  EditorState.platforms.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'selectable' + (p.id === EditorState.selectedPlatformId ? ' active' : '');
    li.innerHTML = `
      <input type="checkbox" ${p.enabled ? 'checked' : ''} title="Enable/Disable" style="width:auto;">
      <span class="item-name" title="${p.name}">${p.name}</span>
      <span class="row-actions"><button class="btn-icon btn-sm" data-act="edit" title="Edit">&#9998;</button></span>`;
    li.querySelector('.item-name').addEventListener('click', () => {
      EditorState.selectedPlatformId = p.id;
      renderPlatformList();
    });
    li.querySelector('input[type=checkbox]').addEventListener('change', async (e) => {
      await API.patch(`/api/platforms/${p.id}`, { enabled: e.target.checked });
    });
    li.querySelector('[data-act="edit"]').addEventListener('click', () => {
      EditorState.editingPlatformId = p.id;
      Views.show('settings-stream');
      document.dispatchEvent(new CustomEvent('platform:edit', { detail: p }));
    });
    list.appendChild(li);
  });
}

document.getElementById('platform-add-btn').addEventListener('click', () => {
  EditorState.editingPlatformId = null;
  Views.show('settings-stream');
  document.dispatchEvent(new CustomEvent('platform:edit', { detail: null }));
});

document.getElementById('platform-remove-btn').addEventListener('click', async () => {
  if (!EditorState.selectedPlatformId) return;
  if (!confirm('Remove this platform?')) return;
  await API.del(`/api/platforms/${EditorState.selectedPlatformId}`);
  EditorState.selectedPlatformId = null;
  loadPlatforms();
});

// ---------------------------------------------------------------- Controls / Status
document.getElementById('start-stream-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('controls-error');
  errorEl.hidden = true;
  try { await API.post('/api/stream/start'); }
  catch (err) { errorEl.textContent = err.message; errorEl.hidden = false; }
});
document.getElementById('stop-stream-btn').addEventListener('click', async () => {
  await API.post('/api/stream/stop');
});

function formatUptime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function pollStatus() {
  try {
    const status = await API.get('/api/stream/status');
    document.getElementById('uptime').textContent = formatUptime(status.uptimeSeconds);
    const bar = document.getElementById('status-bar');
    const statusEl = document.getElementById('stream-status');
    bar.classList.toggle('live', status.live);
    statusEl.textContent = status.live ? 'Live' : 'Offline';
  } catch (_) { /* ignore transient errors */ }
}
setInterval(pollStatus, 1000);

// ---------------------------------------------------------------- Init
async function loadVideoResolutionIntoWorkspace() {
  const data = await API.get('/api/settings');
  const res = data.video.resolution === 'Custom'
    ? { w: data.video.customWidth, h: data.video.customHeight }
    : (() => { const [w, h] = data.video.resolution.split('x').map(Number); return { w, h }; })();
  await Workspace.setOutputResolution(res.w, res.h);
  Workspace.render(EditorState.sources);
}

(async function initEditor() {
  await loadVideoResolutionIntoWorkspace();
  await loadScenes();
  await loadPlatforms();
  pollStatus();
})();

document.addEventListener('view:show', (e) => {
  if (e.detail.view === 'editor') { loadScenes(); loadPlatforms(); loadVideoResolutionIntoWorkspace(); }
});
