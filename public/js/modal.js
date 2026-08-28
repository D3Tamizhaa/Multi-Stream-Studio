const Modal = (() => {
  const root = () => document.getElementById('modal-root');

  function close() { root().innerHTML = ''; }

  function open(html, onMount) {
    root().innerHTML = `<div class="modal-overlay"><div class="modal-card">${html}</div></div>`;
    root().querySelector('.modal-overlay').addEventListener('click', (e) => { if (e.target.classList.contains('modal-overlay')) close(); });
    if (onMount) onMount(root().querySelector('.modal-card'));
  }

  function prompt(title, label, defaultValue, onSubmit) {
    open(`
      <h3>${title}</h3>
      <div class="field-row"><label>${label}</label><input id="modal-input" value="${defaultValue || ''}" /></div>
      <div class="modal-actions">
        <button id="modal-cancel" class="secondary-btn">Cancel</button>
        <button id="modal-ok" class="primary-btn">Add</button>
      </div>`, (card) => {
      card.querySelector('#modal-cancel').addEventListener('click', close);
      card.querySelector('#modal-ok').addEventListener('click', async () => {
        const val = card.querySelector('#modal-input').value;
        close();
        await onSubmit(val);
      });
      card.querySelector('#modal-input').focus();
    });
  }

  async function uploadFile(input) {
    if (!input.files || !input.files[0]) return null;
    const fd = new FormData();
    fd.append('file', input.files[0]);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    return data.url;
  }

  function addSource(scene, onDone) {
    open(`
      <h3>Add Source</h3>
      <div class="field-row"><label>Type</label>
        <select id="src-type">
          <option>Image</option><option>Media</option><option>Text</option><option>Browser Source</option>
        </select>
      </div>
      <div class="field-row"><label>Source Name</label><input id="src-name" /></div>
      <div id="src-type-fields"></div>
      <div class="modal-actions">
        <button id="modal-cancel" class="secondary-btn">Cancel</button>
        <button id="modal-ok" class="primary-btn">Add Source</button>
      </div>`, (card) => {
      const typeSel = card.querySelector('#src-type');
      const fields = card.querySelector('#src-type-fields');

      function renderTypeFields() {
        const t = typeSel.value;
        if (t === 'Image') {
          fields.innerHTML = `
            <div class="field-row"><label>Image File</label><input type="file" id="f-file" accept=".png,.jpg,.jpeg,.gif,.tga,.bmp" /></div>
            <div class="field-grid">
              <div class="field-row"><label>Width</label><input id="f-w" type="number" value="320" /></div>
              <div class="field-row"><label>Height</label><input id="f-h" type="number" value="180" /></div>
            </div>`;
        } else if (t === 'Media') {
          fields.innerHTML = `
            <div class="field-row"><label>Local File</label><input type="file" id="f-file" accept=".mp4,.mp3,.webm" /></div>
            <div class="field-row checkbox"><input type="checkbox" id="f-loop" /><label>Loop</label></div>
            <div class="field-grid">
              <div class="field-row"><label>Width</label><input id="f-w" type="number" value="480" /></div>
              <div class="field-row"><label>Height</label><input id="f-h" type="number" value="270" /></div>
            </div>`;
        } else if (t === 'Text') {
          fields.innerHTML = `
            <div class="field-row"><label>Font Family</label><input id="f-font" value="sans-serif" /></div>
            <div class="field-row"><label>Font Size</label><input id="f-fontsize" type="number" value="32" /></div>
            <div class="field-row"><label>Text</label><input id="f-text" /></div>
            <div class="field-row"><label>Color</label><input id="f-color" type="color" value="#ffffff" /></div>
            <div class="field-grid">
              <div class="field-row"><label>Width</label><input id="f-w" type="number" value="300" /></div>
              <div class="field-row"><label>Height</label><input id="f-h" type="number" value="60" /></div>
            </div>`;
        } else {
          fields.innerHTML = `
            <div class="field-row"><label>URL</label><input id="f-url" placeholder="https://" /></div>
            <div class="field-grid">
              <div class="field-row"><label>Width</label><input id="f-w" type="number" value="640" /></div>
              <div class="field-row"><label>Height</label><input id="f-h" type="number" value="360" /></div>
            </div>
            <div class="field-row"><label>Custom CSS</label><textarea id="f-css" rows="3"></textarea></div>`;
        }
      }
      typeSel.addEventListener('change', renderTypeFields);
      renderTypeFields();

      card.querySelector('#modal-cancel').addEventListener('click', close);
      card.querySelector('#modal-ok').addEventListener('click', async () => {
        const t = typeSel.value;
        const name = card.querySelector('#src-name').value || t;
        const width = Number(card.querySelector('#f-w').value);
        const height = Number(card.querySelector('#f-h').value);
        let props = {};
        if (t === 'Image' || t === 'Media') {
          const fileInput = card.querySelector('#f-file');
          const url = await uploadFile(fileInput);
          if (!url) return alert('Please choose a file.');
          props = { url };
          if (t === 'Media') props.loop = card.querySelector('#f-loop').checked;
        } else if (t === 'Text') {
          props = {
            fontFamily: card.querySelector('#f-font').value,
            fontSize: Number(card.querySelector('#f-fontsize').value),
            text: card.querySelector('#f-text').value,
            color: card.querySelector('#f-color').value
          };
        } else {
          props = { url: card.querySelector('#f-url').value, customCSS: card.querySelector('#f-css').value };
        }
        close();
        await API.post(`/api/scenes/${scene.id}/sources`, { type: t, name, width, height, props });
        await onDone();
      });
    });
  }

  function sourceProperties(scene, src, onDone) {
    const isText = src.type === 'Text';
    const isBrowser = src.type === 'Browser Source';
    const isMedia = src.type === 'Media';
    open(`
      <h3>${src.name} Properties</h3>
      <div class="field-row"><label>Source Name</label><input id="p-name" value="${src.name}" /></div>
      <div class="field-grid">
        <div class="field-row"><label>Width</label><input id="p-w" type="number" value="${src.width}" /></div>
        <div class="field-row"><label>Height</label><input id="p-h" type="number" value="${src.height}" /></div>
      </div>
      ${isText ? `
        <div class="field-row"><label>Text</label><input id="p-text" value="${src.props.text || ''}" /></div>
        <div class="field-row"><label>Color</label><input id="p-color" type="color" value="${src.props.color || '#ffffff'}" /></div>
        <div class="field-row"><label>Font Size</label><input id="p-fontsize" type="number" value="${src.props.fontSize || 32}" /></div>
      ` : ''}
      ${isBrowser ? `
        <div class="field-row"><label>URL</label><input id="p-url" value="${src.props.url || ''}" /></div>
        <div class="field-row"><label>Custom CSS</label><textarea id="p-css" rows="3">${src.props.customCSS || ''}</textarea></div>
      ` : ''}
      ${isMedia ? `<div class="field-row checkbox"><input type="checkbox" id="p-loop" ${src.props.loop ? 'checked' : ''} /><label>Loop</label></div>` : ''}
      <div class="modal-actions">
        <button id="modal-cancel" class="secondary-btn">Cancel</button>
        <button id="modal-ok" class="primary-btn">Save</button>
      </div>`, (card) => {
      card.querySelector('#modal-cancel').addEventListener('click', close);
      card.querySelector('#modal-ok').addEventListener('click', async () => {
        const patch = {
          name: card.querySelector('#p-name').value,
          width: Number(card.querySelector('#p-w').value),
          height: Number(card.querySelector('#p-h').value),
          props: { ...src.props }
        };
        if (isText) {
          patch.props.text = card.querySelector('#p-text').value;
          patch.props.color = card.querySelector('#p-color').value;
          patch.props.fontSize = Number(card.querySelector('#p-fontsize').value);
        }
        if (isBrowser) {
          patch.props.url = card.querySelector('#p-url').value;
          patch.props.customCSS = card.querySelector('#p-css').value;
        }
        if (isMedia) patch.props.loop = card.querySelector('#p-loop').checked;
        close();
        await API.put(`/api/scenes/${scene.id}/sources/${src.id}`, patch);
        await onDone();
      });
    });
  }

  function addPlatform(onDone) {
    open(`
      <h3>Add Platform</h3>
      <div class="field-row"><label>Service</label>
        <select id="pf-service"><option>YouTube</option><option>Facebook</option><option>Twitch</option><option>Kick</option><option>RTMP</option></select>
      </div>
      <div class="field-row hidden" id="pf-name-row"><label>Service Name</label><input id="pf-name" /></div>
      <div class="field-row"><label>Server</label><input id="pf-server" /></div>
      <div class="field-row"><label>Stream Key</label><input id="pf-key" type="password" /></div>
      <div class="modal-actions">
        <button id="modal-cancel" class="secondary-btn">Cancel</button>
        <button id="modal-ok" class="primary-btn">Add</button>
      </div>`, (card) => {
      const serviceSel = card.querySelector('#pf-service');
      const nameRow = card.querySelector('#pf-name-row');
      const serverInput = card.querySelector('#pf-server');

      async function sync() {
        if (serviceSel.value === 'RTMP') {
          nameRow.classList.remove('hidden');
          serverInput.readOnly = false;
          serverInput.value = '';
        } else {
          nameRow.classList.add('hidden');
          const { server } = await API.get(`/api/settings/servers/${serviceSel.value}`);
          serverInput.value = server;
          serverInput.readOnly = true;
        }
      }
      serviceSel.addEventListener('change', sync);
      sync();

      card.querySelector('#modal-cancel').addEventListener('click', close);
      card.querySelector('#modal-ok').addEventListener('click', async () => {
        const service = serviceSel.value;
        const name = service === 'RTMP' ? (card.querySelector('#pf-name').value || 'RTMP') : service;
        const server = serverInput.value;
        const key = card.querySelector('#pf-key').value;
        close();
        await API.post('/api/platforms', { service, name, server, key });
        await onDone();
      });
    });
  }

  return { prompt, addSource, sourceProperties, addPlatform, close };
})();
