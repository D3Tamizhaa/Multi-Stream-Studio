const SettingsForms = (() => {
  let maps = null; // {videoEncoders, audioEncoders, services}

  async function loadMaps() {
    if (!maps) maps = await API.get('/api/maps');
    return maps;
  }

  function opts(list, selected) {
    return list.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
  }

  // ---------- Authorization ----------
  async function renderAuthorization(body) {
    const cur = await API.get('/api/auth/authorization');
    body.innerHTML = `
      <div class="field-row"><label>Username</label><input id="f-username" value="${cur.username}" /></div>
      <div class="field-row"><label>Password</label><input id="f-password" type="password" placeholder="Leave blank to keep current" /></div>
    `;
    return async () => {
      await API.put('/api/auth/authorization', {
        username: document.getElementById('f-username').value,
        password: document.getElementById('f-password').value || undefined
      });
    };
  }

  // ---------- Stream ----------
  async function renderStream(body) {
    const m = await loadMaps();
    const cur = await API.get('/api/settings/stream');
    body.innerHTML = `
      <div class="field-row"><label>Service</label>
        <select id="f-service">${opts([...m.services, 'RTMP'], cur.service)}</select>
      </div>
      <div class="field-row hidden" id="row-custom-name"><label>Service Name</label><input id="f-custom-name" value="${cur.customName || ''}" placeholder="e.g. My Custom RTMP" /></div>
      <div class="field-row"><label>Server</label><input id="f-server" value="${cur.server || ''}" /></div>
      <div class="field-row"><label>Stream Key</label><input id="f-key" type="password" value="${cur.key || ''}" /></div>
    `;
    const serviceSel = document.getElementById('f-service');
    const serverInput = document.getElementById('f-server');
    const customRow = document.getElementById('row-custom-name');

    async function syncServer() {
      const service = serviceSel.value;
      if (service === 'RTMP') {
        customRow.classList.remove('hidden');
        serverInput.readOnly = false;
      } else {
        customRow.classList.add('hidden');
        const { server } = await API.get(`/api/settings/servers/${service}`);
        serverInput.value = server;
        serverInput.readOnly = true;
      }
    }
    serviceSel.addEventListener('change', syncServer);
    await syncServer();
    if (cur.service === 'RTMP') serverInput.value = cur.server || '';

    return async () => {
      await API.put('/api/settings/stream', {
        service: serviceSel.value,
        server: serverInput.value,
        key: document.getElementById('f-key').value,
        customName: document.getElementById('f-custom-name').value
      });
    };
  }

  // ---------- Output ----------
  async function renderOutput(body) {
    const m = await loadMaps();
    const cur = await API.get('/api/settings/output');
    body.innerHTML = `
      <div class="tabbar">
        <button type="button" data-mode="Simple" class="${cur.mode === 'Simple' ? 'active' : ''}">Simple</button>
        <button type="button" data-mode="Advanced" class="${cur.mode === 'Advanced' ? 'active' : ''}">Advanced</button>
      </div>
      <div id="output-simple" class="${cur.mode === 'Simple' ? '' : 'hidden'}">
        <div class="section-label">Video</div>
        <div class="field-grid">
          <div class="field-row"><label>Encoder</label><select id="s-venc">${opts(Object.keys(m.videoEncoders), cur.simple.videoEncoder)}</select></div>
          <div class="field-row"><label>Bitrate (kbps)</label><input id="s-vbr" type="number" value="${cur.simple.videoBitrate}" /></div>
        </div>
        <div class="section-label">Audio</div>
        <div class="field-grid">
          <div class="field-row"><label>Encoder</label><select id="s-aenc">${opts(m.audioEncoders, cur.simple.audioEncoder)}</select></div>
          <div class="field-row"><label>Bitrate (kbps)</label><input id="s-abr" type="number" value="${cur.simple.audioBitrate}" /></div>
        </div>
        <div class="field-row"><label>Preset</label><select id="s-preset"></select></div>
      </div>
      <div id="output-advanced" class="${cur.mode === 'Advanced' ? '' : 'hidden'}">
        <div class="section-label">Audio</div>
        <div class="field-grid">
          <div class="field-row"><label>Encoder</label><select id="a-aenc">${opts(m.audioEncoders, cur.advanced.audio.encoder)}</select></div>
          <div class="field-row"><label>Bitrate (kbps)</label><input id="a-abr" type="number" value="${cur.advanced.audio.bitrate}" /></div>
        </div>
        <div class="section-label">Video</div>
        <div class="field-grid">
          <div class="field-row"><label>Encoder</label><select id="a-venc">${opts(Object.keys(m.videoEncoders), cur.advanced.video.encoder)}</select></div>
          <div class="field-row"><label>Rate Control</label><select id="a-rc"></select></div>
          <div class="field-row"><label>Bitrate (kbps)</label><input id="a-vbr" type="number" value="${cur.advanced.video.bitrate}" /></div>
          <div class="field-row"><label>Keyframe Interval (s)</label><input id="a-kf" type="number" value="${cur.advanced.video.keyframeInterval}" /></div>
          <div class="field-row"><label>Preset</label><select id="a-preset"></select></div>
          <div class="field-row"><label>Profile</label><select id="a-profile"></select></div>
          <div class="field-row"><label>Tune</label><select id="a-tune"></select></div>
        </div>
      </div>
    `;

    // tab switching
    body.querySelectorAll('.tabbar button').forEach(btn => btn.addEventListener('click', () => {
      body.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('output-simple').classList.toggle('hidden', btn.dataset.mode !== 'Simple');
      document.getElementById('output-advanced').classList.toggle('hidden', btn.dataset.mode !== 'Advanced');
    }));

    function syncEncoderOptions(encSelectId, targets, capsFor) {
      const enc = document.getElementById(encSelectId).value;
      const caps = m.videoEncoders[enc];
      targets.forEach(({ id, key, current }) => {
        const el = document.getElementById(id);
        el.innerHTML = opts(caps[key], current);
      });
    }

    const simplePresetSync = () => syncEncoderOptions('s-venc', [{ id: 's-preset', key: 'preset', current: cur.simple.preset }]);
    document.getElementById('s-venc').addEventListener('change', simplePresetSync);
    simplePresetSync();

    const advSync = () => syncEncoderOptions('a-venc', [
      { id: 'a-rc', key: 'rateControl', current: cur.advanced.video.rateControl },
      { id: 'a-preset', key: 'preset', current: cur.advanced.video.preset },
      { id: 'a-profile', key: 'profile', current: cur.advanced.video.profile },
      { id: 'a-tune', key: 'tune', current: cur.advanced.video.tune }
    ]);
    document.getElementById('a-venc').addEventListener('change', advSync);
    advSync();

    return async () => {
      const mode = body.querySelector('.tabbar button.active').dataset.mode;
      await API.put('/api/settings/output', {
        mode,
        simple: {
          videoEncoder: document.getElementById('s-venc').value,
          videoBitrate: Number(document.getElementById('s-vbr').value),
          audioEncoder: document.getElementById('s-aenc').value,
          audioBitrate: Number(document.getElementById('s-abr').value),
          preset: document.getElementById('s-preset').value
        },
        advanced: {
          audio: { encoder: document.getElementById('a-aenc').value, bitrate: Number(document.getElementById('a-abr').value) },
          video: {
            encoder: document.getElementById('a-venc').value,
            rateControl: document.getElementById('a-rc').value,
            bitrate: Number(document.getElementById('a-vbr').value),
            keyframeInterval: Number(document.getElementById('a-kf').value),
            preset: document.getElementById('a-preset').value,
            profile: document.getElementById('a-profile').value,
            tune: document.getElementById('a-tune').value
          }
        }
      });
    };
  }

  // ---------- Audio ----------
  async function renderAudio(body) {
    const cur = await API.get('/api/settings/audio');
    body.innerHTML = `
      <div class="field-row"><label>Sample Rate</label><select id="f-samplerate">${opts(['44.1 kHz', '48 kHz'], cur.sampleRate)}</select></div>
      <div class="field-row"><label>Channels</label><select id="f-channels">${opts(['Mono', 'Stereo', '5.1 surround', '7.1 surround'], cur.channels)}</select></div>
    `;
    return async () => {
      await API.put('/api/settings/audio', {
        sampleRate: document.getElementById('f-samplerate').value,
        channels: document.getElementById('f-channels').value
      });
    };
  }

  // ---------- Video ----------
  function resFields(prefix, cur, customCur) {
    return `
      <div class="field-row"><label>${prefix} Resolution</label>
        <select id="f-${prefix}-res">${opts(['1920x1080', '1280x720', '852x480', '640x360', 'Custom'], cur)}</select>
      </div>
      <div class="field-row ${cur === 'Custom' ? '' : 'hidden'}" id="row-${prefix}-custom">
        <label>Custom Width x Height</label>
        <div style="display:flex;gap:8px;">
          <input id="f-${prefix}-w" type="number" value="${customCur.width}" style="width:50%" />
          <input id="f-${prefix}-h" type="number" value="${customCur.height}" style="width:50%" />
        </div>
      </div>
    `;
  }

  async function renderVideo(body) {
    const cur = await API.get('/api/settings/video');
    body.innerHTML = `
      ${resFields('base', cur.baseResolution, cur.baseCustom)}
      ${resFields('output', cur.outputResolution, cur.outputCustom)}
      <div class="field-row"><label>FPS</label>
        <select id="f-fps">${opts([10, 20, 24, 25, 29.97, 30, 48, 59.94, 60], cur.fps)}</select>
      </div>
    `;
    ['base', 'output'].forEach(prefix => {
      const sel = document.getElementById(`f-${prefix}-res`);
      sel.addEventListener('change', () => {
        document.getElementById(`row-${prefix}-custom`).classList.toggle('hidden', sel.value !== 'Custom');
      });
    });
    return async () => {
      const baseRes = document.getElementById('f-base-res').value;
      const outputRes = document.getElementById('f-output-res').value;
      await API.put('/api/settings/video', {
        baseResolution: baseRes,
        baseCustom: { width: Number(document.getElementById('f-base-w').value), height: Number(document.getElementById('f-base-h').value) },
        outputResolution: outputRes,
        outputCustom: { width: Number(document.getElementById('f-output-w').value), height: Number(document.getElementById('f-output-h').value) },
        fps: Number(document.getElementById('f-fps').value)
      });
    };
  }

  // ---------- Advanced ----------
  async function renderAdvanced(body) {
    const cur = await API.get('/api/settings/advanced');
    body.innerHTML = `
      <div class="field-row checkbox"><input type="checkbox" id="f-reconnect" ${cur.autoReconnect ? 'checked' : ''} /><label>Automatically Reconnect</label></div>
      <div class="field-row"><label>Network - Bind IP</label><input id="f-bindip" value="${cur.network.bindIP}" /></div>
    `;
    return async () => {
      await API.put('/api/settings/advanced', {
        autoReconnect: document.getElementById('f-reconnect').checked,
        network: { bindIP: document.getElementById('f-bindip').value }
      });
    };
  }

  return { renderAuthorization, renderStream, renderOutput, renderAudio, renderVideo, renderAdvanced };
})();
