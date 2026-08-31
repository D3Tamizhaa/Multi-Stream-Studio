const SettingsModule = (() => {
  let settings = null;
  let capabilities = null;
  let streamServers = null;
  let currentSection = 'authorization';
  let pendingApply = null; // fn to call on Apply

  async function init() {
    document.getElementById('settings-cancel-btn').addEventListener('click', () => window.showView('editor'));
    document.getElementById('settings-apply-btn').addEventListener('click', async () => {
      if (pendingApply) {
        const err = await pendingApply();
        if (err) return alert(err);
      }
      window.showView('editor');
    });
  }

  async function showSection(section) {
    currentSection = section;
    document.getElementById('settings-title').textContent = 'Settings · ' + labelFor(section);
    const body = document.getElementById('settings-body');
    body.innerHTML = '<div class="empty-hint">Loading…</div>';

    if (section !== 'authorization') settings = await api.get('/api/settings');
    if (section === 'output' && !capabilities) capabilities = await api.get('/api/settings/capabilities');
    if (section === 'stream' && !streamServers) streamServers = await api.get('/api/settings/stream/servers');

    const applyBtn = document.getElementById('settings-apply-btn');
    // Authorization & Stream save immediately per-action; Apply button hidden for them.
    applyBtn.style.display = (section === 'authorization' || section === 'stream') ? 'none' : 'inline-block';

    if (section === 'authorization') renderAuthorization(body);
    else if (section === 'stream') renderStream(body);
    else if (section === 'output') renderOutput(body);
    else if (section === 'audio') renderAudio(body);
    else if (section === 'video') renderVideo(body);
    else if (section === 'advanced') renderAdvanced(body);
  }

  function labelFor(s) {
    return { authorization: 'Authorization', stream: 'Stream', output: 'Output', audio: 'Audio', video: 'Video', advanced: 'Advanced' }[s] || s;
  }

  // ================= Authorization =================
  function renderAuthorization(body) {
    body.innerHTML = `
      <div class="settings-section">
        <div class="field-row"><label>Username</label><input id="s-username" type="text" value="${escapeAttr(CURRENT_USER.username)}" /></div>
        <div class="field-row"><label>Password</label><input id="s-password" type="password" placeholder="New password" /></div>
        <p id="s-auth-error" class="error-text"></p>
        <div class="modal-actions" style="justify-content:flex-start">
          <button class="btn btn-primary" id="s-auth-update">Update</button>
          <button class="btn btn-secondary" id="s-auth-cancel">Cancel</button>
        </div>
      </div>`;
    body.querySelector('#s-auth-cancel').addEventListener('click', () => window.showView('editor'));
    body.querySelector('#s-auth-update').addEventListener('click', async () => {
      const username = body.querySelector('#s-username').value.trim();
      const password = body.querySelector('#s-password').value;
      const errEl = body.querySelector('#s-auth-error');
      errEl.textContent = '';
      if (!password) { errEl.textContent = 'Enter a new password to update'; return; }
      try {
        CURRENT_USER = await api.put('/api/auth/credentials', { username, password });
        document.getElementById('header-username').textContent = CURRENT_USER.username;
        window.showView('editor');
      } catch (e) { errEl.textContent = e.message; }
    });
  }

  // ================= Stream =================
  function renderStream(body) {
    const services = settings.stream.services;
    body.innerHTML = `
      <div class="settings-section">
        <div class="field-row"><label>Service</label>
          <select id="s-service">
            <option value="YouTube">YouTube</option>
            <option value="Facebook">Facebook</option>
            <option value="Twitch">Twitch</option>
            <option value="Kick">Kick</option>
            <option value="RTMP">RTMP</option>
          </select>
        </div>
        <div id="s-rtmp-name-wrap" class="field-row hidden"><label>Service Name</label><input id="s-rtmp-name" type="text" placeholder="e.g. My Custom CDN" /></div>
        <div class="field-row"><label>Server</label><input id="s-server" type="text" readonly /></div>
        <div class="field-row"><label>Stream Key</label>
          <div class="inline-key-toggle">
            <input id="s-key" type="password" placeholder="Paste your stream key" />
            <button class="tiny-btn" id="s-key-toggle" type="button" title="Show">👁</button>
          </div>
        </div>
        <p id="s-stream-error" class="error-text"></p>
        <div class="modal-actions" style="justify-content:flex-start">
          <button class="btn btn-primary" id="s-add-service">Add Service</button>
          <button class="btn btn-secondary" id="s-cancel-service">Cancel</button>
        </div>
      </div>
      <div class="settings-section">
        <h3 style="margin-top:0">Configured Services</h3>
        <div id="s-service-list" class="list service-row-list"></div>
      </div>`;

    const serviceSel = body.querySelector('#s-service');
    const serverInput = body.querySelector('#s-server');
    const nameWrap = body.querySelector('#s-rtmp-name-wrap');

    function syncServerField() {
      const val = serviceSel.value;
      if (val === 'RTMP') {
        nameWrap.classList.remove('hidden');
        serverInput.readOnly = false;
        serverInput.value = '';
        serverInput.placeholder = 'rtmp://your-server/app';
      } else {
        nameWrap.classList.add('hidden');
        serverInput.readOnly = true;
        serverInput.value = streamServers[val] || '';
      }
    }
    serviceSel.addEventListener('change', syncServerField);
    syncServerField();

    body.querySelector('#s-key-toggle').addEventListener('click', () => {
      const inp = body.querySelector('#s-key');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    body.querySelector('#s-cancel-service').addEventListener('click', () => window.showView('editor'));
    body.querySelector('#s-add-service').addEventListener('click', async () => {
      const errEl = body.querySelector('#s-stream-error');
      errEl.textContent = '';
      const service = serviceSel.value;
      const payload = { service, streamKey: body.querySelector('#s-key').value.trim() };
      if (service === 'RTMP') {
        payload.server = serverInput.value.trim();
        payload.name = body.querySelector('#s-rtmp-name').value.trim();
      }
      try {
        await api.post('/api/settings/stream/services', payload);
        settings = await api.get('/api/settings');
        renderStream(body);
      } catch (e) { errEl.textContent = e.message; }
    });

    renderServiceList(body, services);
  }

  function renderServiceList(body, services) {
    const list = body.querySelector('#s-service-list');
    list.innerHTML = '';
    if (!services.length) {
      list.innerHTML = '<div class="empty-hint">No services added yet</div>';
      return;
    }
    services.forEach((svc) => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <span class="name">${escapeHtml(svc.name)} <span style="color:var(--text-dim)">(${escapeHtml(svc.service)})</span></span>
        <button class="tiny-btn" data-act="edit">✏️</button>
        <button class="tiny-btn" data-act="remove">🗑</button>`;
      row.querySelector('[data-act="edit"]').addEventListener('click', () => openEditServiceModal(svc, body));
      row.querySelector('[data-act="remove"]').addEventListener('click', async () => {
        if (!confirm(`Remove ${svc.name}?`)) return;
        await api.del(`/api/settings/stream/services/${svc.id}`);
        settings = await api.get('/api/settings');
        renderStream(body);
      });
      list.appendChild(row);
    });
  }

  function openEditServiceModal(svc, body) {
    const isRtmp = svc.service === 'RTMP';
    const html = `
      <h3>Edit ${escapeHtml(svc.name)}</h3>
      ${isRtmp ? `<div class="field-row"><label>Service Name</label><input id="e-name" type="text" value="${escapeAttr(svc.name)}" /></div>
      <div class="field-row"><label>Server</label><input id="e-server" type="text" value="${escapeAttr(svc.server)}" /></div>` : ''}
      <div class="field-row"><label>Stream Key</label><input id="e-key" type="password" value="${escapeAttr(svc.streamKey)}" /></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">Close</button>
        <button class="btn btn-primary" id="m-save">Save</button>
      </div>`;
    const overlay = document.getElementById('modal-overlay');
    const root = document.getElementById('modal-root');
    overlay.classList.remove('hidden'); root.classList.remove('hidden');
    root.innerHTML = `<div class="modal-card">${html}</div>`;
    const close = () => { overlay.classList.add('hidden'); root.classList.add('hidden'); root.innerHTML = ''; };
    root.querySelector('#m-cancel').addEventListener('click', close);
    root.querySelector('#m-save').addEventListener('click', async () => {
      const payload = { streamKey: root.querySelector('#e-key').value.trim() };
      if (isRtmp) {
        payload.name = root.querySelector('#e-name').value.trim();
        payload.server = root.querySelector('#e-server').value.trim();
      }
      await api.put(`/api/settings/stream/services/${svc.id}`, payload);
      settings = await api.get('/api/settings');
      close();
      renderStream(body);
    });
  }

  // ================= Output =================
  function renderOutput(body) {
    const out = settings.output;
    const videoEncoders = Object.keys(capabilities.video);
    const audioEncoders = Object.keys(capabilities.audio);

    body.innerHTML = `
      <div class="settings-section">
        <div class="field-row"><label>Output Mode</label>
          <select id="o-mode">
            <option value="simple" ${out.mode === 'simple' ? 'selected' : ''}>Simple</option>
            <option value="advanced" ${out.mode === 'advanced' ? 'selected' : ''}>Advanced</option>
          </select>
        </div>
      </div>
      <div id="o-simple" class="settings-section ${out.mode === 'simple' ? '' : 'hidden'}">
        <h3 style="margin-top:0">Simple</h3>
        <div class="field-grid">
          <div class="field-row"><label>Video Encoder</label><select id="os-venc">${opts(videoEncoders, out.simple.video.encoder)}</select></div>
          <div class="field-row"><label>Video Bitrate (kbps)</label><input id="os-vbitrate" type="number" value="${out.simple.video.bitrate}" /></div>
          <div class="field-row"><label>Audio Encoder</label><select id="os-aenc">${opts(audioEncoders, out.simple.audio.encoder)}</select></div>
          <div class="field-row"><label>Audio Bitrate (kbps)</label><input id="os-abitrate" type="number" value="${out.simple.audio.bitrate}" /></div>
          <div class="field-row"><label>Preset</label><select id="os-preset"></select></div>
        </div>
      </div>
      <div id="o-advanced" class="settings-section ${out.mode === 'advanced' ? '' : 'hidden'}">
        <h3 style="margin-top:0">Advanced · Audio</h3>
        <div class="field-grid">
          <div class="field-row"><label>Encoder</label><select id="oa-aenc">${opts(audioEncoders, out.advanced.audio.encoder)}</select></div>
          <div class="field-row"><label>Bitrate (kbps)</label><select id="oa-abitrate"></select></div>
        </div>
        <h3>Advanced · Video</h3>
        <div class="field-grid">
          <div class="field-row"><label>Encoder</label><select id="oa-venc">${opts(videoEncoders, out.advanced.video.encoder)}</select></div>
          <div class="field-row"><label>Rate Control</label><select id="oa-rc"></select></div>
          <div class="field-row"><label>Bitrate (kbps)</label><input id="oa-vbitrate" type="number" value="${out.advanced.video.bitrate}" /></div>
          <div class="field-row"><label>Keyframe Interval (s)</label><input id="oa-gop" type="number" value="${out.advanced.video.keyframeInterval}" /></div>
          <div class="field-row"><label>Preset</label><select id="oa-preset"></select></div>
          <div class="field-row"><label>Profile</label><select id="oa-profile"></select></div>
          <div class="field-row"><label>Tune</label><select id="oa-tune"></select></div>
        </div>
      </div>`;

    const modeSel = body.querySelector('#o-mode');
    modeSel.addEventListener('change', () => {
      body.querySelector('#o-simple').classList.toggle('hidden', modeSel.value !== 'simple');
      body.querySelector('#o-advanced').classList.toggle('hidden', modeSel.value !== 'advanced');
    });

    // Simple preset options come from the chosen encoder's capability set
    function syncSimplePreset() {
      const enc = body.querySelector('#os-venc').value;
      fillSelect(body.querySelector('#os-preset'), capabilities.video[enc].preset, out.simple.preset);
    }
    body.querySelector('#os-venc').addEventListener('change', syncSimplePreset);
    syncSimplePreset();

    // Advanced audio bitrate list depends on encoder
    function syncAdvAudioBitrate() {
      const enc = body.querySelector('#oa-aenc').value;
      const bitrates = capabilities.audio[enc].bitrates;
      const sel = body.querySelector('#oa-abitrate');
      if (!bitrates.length) {
        sel.innerHTML = '<option value="">N/A (lossless / copy)</option>';
        sel.disabled = true;
      } else {
        sel.disabled = false;
        fillSelect(sel, bitrates.map(String), String(out.advanced.audio.bitrate));
      }
    }
    body.querySelector('#oa-aenc').addEventListener('change', syncAdvAudioBitrate);
    syncAdvAudioBitrate();

    // Advanced video: rate control / preset / profile / tune all depend on chosen encoder
    function syncAdvVideoOptions() {
      const enc = body.querySelector('#oa-venc').value;
      const def = capabilities.video[enc];
      fillSelect(body.querySelector('#oa-rc'), def.rateControl, out.advanced.video.rateControl);
      fillSelect(body.querySelector('#oa-preset'), def.preset, out.advanced.video.preset);
      fillSelect(body.querySelector('#oa-profile'), def.profile, out.advanced.video.profile);
      fillSelect(body.querySelector('#oa-tune'), def.tune, out.advanced.video.tune);
      body.querySelector('#oa-gop').disabled = !def.keyframeInterval;
      const noEncode = enc === 'None';
      ['#oa-rc', '#oa-vbitrate', '#oa-preset', '#oa-profile', '#oa-tune', '#oa-gop'].forEach((sel) => {
        body.querySelector(sel).disabled = noEncode || body.querySelector(sel).disabled;
      });
    }
    body.querySelector('#oa-venc').addEventListener('change', syncAdvVideoOptions);
    syncAdvVideoOptions();

    pendingApply = async () => {
      const mode = modeSel.value;
      const payload = {
        mode,
        simple: {
          video: { encoder: body.querySelector('#os-venc').value, bitrate: Number(body.querySelector('#os-vbitrate').value) },
          audio: { encoder: body.querySelector('#os-aenc').value, bitrate: Number(body.querySelector('#os-abitrate').value) },
          preset: body.querySelector('#os-preset').value,
        },
        advanced: {
          audio: { encoder: body.querySelector('#oa-aenc').value, bitrate: Number(body.querySelector('#oa-abitrate').value) || 0 },
          video: {
            encoder: body.querySelector('#oa-venc').value,
            rateControl: body.querySelector('#oa-rc').value,
            bitrate: Number(body.querySelector('#oa-vbitrate').value),
            keyframeInterval: Number(body.querySelector('#oa-gop').value),
            preset: body.querySelector('#oa-preset').value,
            profile: body.querySelector('#oa-profile').value,
            tune: body.querySelector('#oa-tune').value,
          },
        },
      };
      try {
        await api.put('/api/settings/output', payload);
        settings.output = payload;
      } catch (e) { return e.message; }
    };
  }

  // ================= Audio =================
  function renderAudio(body) {
    const a = settings.audio;
    body.innerHTML = `
      <div class="settings-section">
        <div class="field-grid">
          <div class="field-row"><label>Sample Rate</label><select id="a-rate">${opts(['44.1 kHz', '48 kHz'], a.sampleRate)}</select></div>
          <div class="field-row"><label>Channels</label><select id="a-channels">${opts(['Mono', 'Stereo', '5.1 surround', '7.1 surround'], a.channels)}</select></div>
        </div>
      </div>`;
    pendingApply = async () => {
      const payload = { sampleRate: body.querySelector('#a-rate').value, channels: body.querySelector('#a-channels').value };
      try { await api.put('/api/settings/audio', payload); settings.audio = payload; } catch (e) { return e.message; }
    };
  }

  // ================= Video =================
  function renderVideo(body) {
    const v = settings.video;
    const resolutions = ['1920x1080', '1280x720', '852x480', '640x360', 'Custom'];
    const fpsValues = ['10', '20', '24', '25', '29.97', '30', '48', '59.94', '60'];
    body.innerHTML = `
      <div class="settings-section">
        <div class="field-row"><label>Output Resolution</label><select id="v-res">${opts(resolutions, v.resolution)}</select></div>
        <div id="v-custom-wrap" class="field-grid ${v.resolution === 'Custom' ? '' : 'hidden'}">
          <div class="field-row"><label>Width</label><input id="v-cwidth" type="number" value="${v.customWidth}" /></div>
          <div class="field-row"><label>Height</label><input id="v-cheight" type="number" value="${v.customHeight}" /></div>
        </div>
        <div class="field-row"><label>FPS</label><select id="v-fps">${opts(fpsValues, String(v.fps))}</select></div>
      </div>`;
    const resSel = body.querySelector('#v-res');
    resSel.addEventListener('change', () => body.querySelector('#v-custom-wrap').classList.toggle('hidden', resSel.value !== 'Custom'));

    pendingApply = async () => {
      const payload = {
        resolution: resSel.value,
        customWidth: Number(body.querySelector('#v-cwidth').value) || 1920,
        customHeight: Number(body.querySelector('#v-cheight').value) || 1080,
        fps: Number(body.querySelector('#v-fps').value),
      };
      try { await api.put('/api/settings/video', payload); settings.video = payload; } catch (e) { return e.message; }
    };
  }

  // ================= Advanced =================
  function renderAdvanced(body) {
    const adv = settings.advanced;
    body.innerHTML = `
      <div class="settings-section">
        <div class="checkbox-row"><input type="checkbox" id="adv-reconnect" ${adv.autoReconnect ? 'checked' : ''} /> <label for="adv-reconnect">Automatically Reconnect</label></div>
        <h3>Network</h3>
        <div class="field-row"><label>Bind IP</label><input id="adv-bindip" type="text" value="${escapeAttr(adv.network.bindIp)}" /></div>
      </div>`;
    pendingApply = async () => {
      const payload = { autoReconnect: body.querySelector('#adv-reconnect').checked, network: { ...adv.network, bindIp: body.querySelector('#adv-bindip').value } };
      try { await api.put('/api/settings/advanced', payload); settings.advanced = payload; } catch (e) { return e.message; }
    };
  }

  // ================= Helpers =================
  function opts(values, selected) {
    return values.map((v) => `<option value="${escapeAttr(v)}" ${v === selected ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
  }
  function fillSelect(selectEl, values, selected) {
    selectEl.innerHTML = opts(values, selected);
    if (!values.includes(selected) && values.length) selectEl.value = values[0];
  }
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  return { init, showSection };
})();

window.SettingsModule = SettingsModule;
