const Settings = (() => {
  let encodersMap = null;
  let currentSettings = null;
  let platformDefaults = {};

  async function ensureData() {
    if (!encodersMap) encodersMap = await Api.getEncoders();
    const s = await Api.getSettings();
    currentSettings = s.settings;
    const p = await Api.getPlatforms();
    platformDefaults = p.defaults;
    return currentSettings;
  }

  function optionsHtml(values, selected) {
    return values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  async function render(subroute) {
    const body = document.getElementById('settings-body');
    await ensureData();
    if (subroute === 'authorization') return renderAuthorization(body);
    if (subroute === 'stream') return renderStream(body);
    if (subroute === 'output') return renderOutput(body);
    if (subroute === 'audio') return renderAudio(body);
    if (subroute === 'video') return renderVideo(body);
    if (subroute === 'advanced') return renderAdvanced(body);
    body.innerHTML = '<p>Unknown settings section.</p>';
  }

  function wireApplyCancel(body, onApply) {
    body.querySelector('#settings-apply').addEventListener('click', async () => {
      try { await onApply(); App.navigate('editor'); }
      catch (e) { alert(e.message); }
    });
    body.querySelector('#settings-cancel').addEventListener('click', () => App.navigate('editor'));
  }

  // ---------------- Authorization ----------------
  function renderAuthorization(body) {
    body.innerHTML = `
      <h2>Authorization</h2>
      <label>Username<input id="auth-username" type="text" value="${esc(App.currentUsername())}"></label>
      <label>Current Password<input id="auth-current" type="password"></label>
      <label>Password (New)<input id="auth-new" type="password"></label>
      <p class="error-text" id="auth-error"></p>
      <div class="settings-actions">
        <button class="btn primary" id="auth-update">Update</button>
        <button class="btn" id="auth-cancel">Cancel</button>
      </div>`;
    body.querySelector('#auth-cancel').addEventListener('click', () => App.navigate('editor'));
    body.querySelector('#auth-update').addEventListener('click', async () => {
      const username = body.querySelector('#auth-username').value.trim();
      const currentPassword = body.querySelector('#auth-current').value;
      const newPassword = body.querySelector('#auth-new').value;
      try {
        const r = await Api.updateAuthorization({ username, currentPassword, newPassword });
        App.setUsername(r.username);
        App.navigate('editor');
      } catch (e) { body.querySelector('#auth-error').textContent = e.message; }
    });
  }

  // ---------------- Stream ----------------
  function renderStream(body) {
    const editingId = window.editingPlatformId;
    const existing = editingId ? Editor.getState().platforms.find(p => p.id === editingId) : null;
    const service = (existing && existing.service) || 'YouTube';
    body.innerHTML = `
      <h2>Stream</h2>
      <label>Service
        <select id="stream-service">
          <option>YouTube</option><option>Facebook</option><option>Twitch</option><option>Kick</option><option>RTMP</option>
        </select>
      </label>
      <div id="rtmp-name-wrap" class="hidden"><label>Service Name<input id="stream-name" type="text" value="${esc(existing && existing.name || '')}"></label></div>
      <label>Server<input id="stream-server" type="text" value="${esc(existing && existing.server || '')}"></label>
      <label>Stream Key
        <div style="display:flex;gap:6px;">
          <input id="stream-key" type="password" value="${esc(existing && existing.streamKey || '')}" style="flex:1;">
          <button type="button" class="btn" id="stream-key-show">Show</button>
        </div>
      </label>
      <p class="error-text" id="stream-error"></p>
      <div class="settings-actions">
        <button class="btn primary" id="stream-add">${existing ? 'Update Service' : 'Add Service'}</button>
        <button class="btn" id="stream-cancel">Cancel</button>
      </div>`;

    const serviceSel = body.querySelector('#stream-service');
    const serverInput = body.querySelector('#stream-server');
    const rtmpNameWrap = body.querySelector('#rtmp-name-wrap');

    function applyServiceRules() {
      const svc = serviceSel.value;
      if (svc === 'RTMP') {
        rtmpNameWrap.classList.remove('hidden');
        serverInput.readOnly = false;
        if (!existing || existing.service !== 'RTMP') serverInput.value = '';
      } else {
        rtmpNameWrap.classList.add('hidden');
        serverInput.readOnly = true;
        serverInput.value = platformDefaults[svc] || '';
      }
    }
    serviceSel.value = service;
    applyServiceRules();
    if (existing && existing.service === 'RTMP') serverInput.value = existing.server;
    serviceSel.addEventListener('change', applyServiceRules);

    body.querySelector('#stream-key-show').addEventListener('click', () => {
      const input = body.querySelector('#stream-key');
      const btn = body.querySelector('#stream-key-show');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    });

    body.querySelector('#stream-cancel').addEventListener('click', () => { window.editingPlatformId = null; App.navigate('editor'); });
    body.querySelector('#stream-add').addEventListener('click', async () => {
      const svc = serviceSel.value;
      const payload = {
        service: svc,
        server: svc === 'RTMP' ? serverInput.value.trim() : (platformDefaults[svc] || ''),
        streamKey: body.querySelector('#stream-key').value.trim(),
        name: svc === 'RTMP' ? (body.querySelector('#stream-name').value.trim() || 'RTMP') : svc
      };
      if (!payload.streamKey) { body.querySelector('#stream-error').textContent = 'Stream key is required.'; return; }
      if (svc === 'RTMP' && !payload.server) { body.querySelector('#stream-error').textContent = 'Server is required for RTMP.'; return; }
      try {
        if (existing) await Api.updatePlatform(existing.id, payload);
        else await Api.addPlatform(payload);
        window.editingPlatformId = null;
        App.navigate('editor');
      } catch (e) { body.querySelector('#stream-error').textContent = e.message; }
    });
  }

  // ---------------- Output ----------------
  function renderOutput(body) {
    const s = currentSettings.output;
    const videoEncoders = Object.keys(encodersMap.video);
    body.innerHTML = `
      <h2>Output</h2>
      <div class="radio-row">
        <label><input type="radio" name="output-mode" value="simple" ${s.mode === 'simple' ? 'checked' : ''}> Simple</label>
        <label><input type="radio" name="output-mode" value="advanced" ${s.mode === 'advanced' ? 'checked' : ''}> Advanced</label>
      </div>
      <div id="output-simple"></div>
      <div id="output-advanced"></div>
      <div class="settings-actions">
        <button class="btn primary" id="settings-apply">Apply</button>
        <button class="btn" id="settings-cancel">Cancel</button>
      </div>`;

    function renderSimple() {
      const sim = s.simple;
      body.querySelector('#output-simple').innerHTML = `
        <fieldset><legend>Video</legend>
          <label>Encoder<select id="simple-venc">${optionsHtml(videoEncoders, sim.videoEncoder)}</select></label>
          <label>Bitrate (kbps)<input id="simple-vbitrate" type="number" value="${sim.videoBitrate}"></label>
        </fieldset>
        <fieldset><legend>Audio</legend>
          <label>Encoder<select id="simple-aenc">${optionsHtml(encodersMap.audio, sim.audioEncoder)}</select></label>
          <label>Bitrate (kbps)<input id="simple-abitrate" type="number" value="${sim.audioBitrate}"></label>
        </fieldset>
        <label>Preset<select id="simple-preset"></select></label>`;
      const fillPreset = () => {
        const cfg = encodersMap.video[body.querySelector('#simple-venc').value];
        const sel = body.querySelector('#simple-preset');
        const opts = cfg.preset.length ? cfg.preset : ['None'];
        sel.innerHTML = optionsHtml(opts, sim.preset);
      };
      body.querySelector('#simple-venc').addEventListener('change', fillPreset);
      fillPreset();
    }

    function renderAdvanced() {
      const adv = s.advanced;
      const el = body.querySelector('#output-advanced');
      el.innerHTML = `
        <fieldset><legend>Audio</legend>
          <label>Encoder<select id="adv-aenc">${optionsHtml(encodersMap.audio, adv.audio.encoder)}</select></label>
          <label>Bitrate (kbps)<input id="adv-abitrate" type="number" value="${adv.audio.bitrate}"></label>
        </fieldset>
        <fieldset><legend>Video</legend>
          <label>Encoder<select id="adv-venc">${optionsHtml(videoEncoders, adv.video.encoder)}</select></label>
          <label>Rate Control<select id="adv-rc"></select></label>
          <label>Bitrate / CRF / QP value<input id="adv-bitrate" type="number" value="${adv.video.bitrate}"></label>
          <label id="adv-keyframe-wrap">Keyframe Interval (seconds)<input id="adv-keyframe" type="number" value="${adv.video.keyframeInterval}"></label>
          <label>Preset<select id="adv-preset"></select></label>
          <label>Profile<select id="adv-profile"></select></label>
          <label>Tune<select id="adv-tune"></select></label>
        </fieldset>`;
      const venc = body.querySelector('#adv-venc');
      const refresh = () => {
        const cfg = encodersMap.video[venc.value];
        body.querySelector('#adv-rc').innerHTML = optionsHtml(cfg.rateControl.length ? cfg.rateControl : ['None'], adv.video.rateControl);
        body.querySelector('#adv-preset').innerHTML = optionsHtml(cfg.preset.length ? [...cfg.preset, 'None'] : ['None'], adv.video.preset);
        body.querySelector('#adv-profile').innerHTML = optionsHtml(cfg.profile.length ? [...cfg.profile, 'None'] : ['None'], adv.video.profile);
        body.querySelector('#adv-tune').innerHTML = optionsHtml(cfg.tune.length ? [...cfg.tune, 'None'] : ['None'], adv.video.tune);
        body.querySelector('#adv-keyframe-wrap').style.display = cfg.keyframe ? '' : 'none';
      };
      venc.addEventListener('change', refresh);
      refresh();
    }

    function showMode() {
      const mode = body.querySelector('input[name=output-mode]:checked').value;
      body.querySelector('#output-simple').style.display = mode === 'simple' ? '' : 'none';
      body.querySelector('#output-advanced').style.display = mode === 'advanced' ? '' : 'none';
    }
    renderSimple(); renderAdvanced(); showMode();
    body.querySelectorAll('input[name=output-mode]').forEach(r => r.addEventListener('change', showMode));

    wireApplyCancel(body, async () => {
      const mode = body.querySelector('input[name=output-mode]:checked').value;
      const payload = {
        mode,
        simple: {
          videoEncoder: body.querySelector('#simple-venc').value,
          videoBitrate: Number(body.querySelector('#simple-vbitrate').value),
          audioEncoder: body.querySelector('#simple-aenc').value,
          audioBitrate: Number(body.querySelector('#simple-abitrate').value),
          preset: body.querySelector('#simple-preset').value
        },
        advanced: {
          audio: { encoder: body.querySelector('#adv-aenc').value, bitrate: Number(body.querySelector('#adv-abitrate').value) },
          video: {
            encoder: body.querySelector('#adv-venc').value,
            rateControl: body.querySelector('#adv-rc').value,
            bitrate: Number(body.querySelector('#adv-bitrate').value),
            keyframeInterval: Number(body.querySelector('#adv-keyframe').value),
            preset: body.querySelector('#adv-preset').value,
            profile: body.querySelector('#adv-profile').value,
            tune: body.querySelector('#adv-tune').value
          }
        }
      };
      await Api.updateSettings('output', payload);
    });
  }

  // ---------------- Audio ----------------
  function renderAudio(body) {
    const s = currentSettings.audio;
    body.innerHTML = `
      <h2>Audio</h2>
      <label>Sample Rate<select id="audio-samplerate">${optionsHtml(['44.1 kHz', '48 kHz'], s.sampleRate)}</select></label>
      <label>Channels<select id="audio-channels">${optionsHtml(['Mono', 'Stereo', '5.1 surround', '7.1 surround'], s.channels)}</select></label>
      <div class="settings-actions">
        <button class="btn primary" id="settings-apply">Apply</button>
        <button class="btn" id="settings-cancel">Cancel</button>
      </div>`;
    wireApplyCancel(body, async () => {
      await Api.updateSettings('audio', {
        sampleRate: body.querySelector('#audio-samplerate').value,
        channels: body.querySelector('#audio-channels').value
      });
    });
  }

  // ---------------- Video ----------------
  function renderVideo(body) {
    const s = currentSettings.video;
    const isCustom = s.resolution === 'Custom';
    body.innerHTML = `
      <h2>Video</h2>
      <label>Output Resolution
        <select id="video-resolution">${optionsHtml(['1920x1080', '1280x720', '852x480', '640x360', 'Custom'], s.resolution)}</select>
      </label>
      <div id="video-custom-wrap" class="field-row ${isCustom ? '' : 'hidden'}">
        <label>Width<input id="video-custom-w" type="number" value="${s.customWidth}"></label>
        <label>Height<input id="video-custom-h" type="number" value="${s.customHeight}"></label>
      </div>
      <label>FPS<select id="video-fps">${optionsHtml([10, 20, 24, 25, 29.97, 30, 48, 59.94, 60], s.fps)}</select></label>
      <div class="settings-actions">
        <button class="btn primary" id="settings-apply">Apply</button>
        <button class="btn" id="settings-cancel">Cancel</button>
      </div>`;
    const resSel = body.querySelector('#video-resolution');
    resSel.addEventListener('change', () => {
      body.querySelector('#video-custom-wrap').classList.toggle('hidden', resSel.value !== 'Custom');
    });
    wireApplyCancel(body, async () => {
      await Api.updateSettings('video', {
        resolution: resSel.value,
        customWidth: Number(body.querySelector('#video-custom-w').value) || 1280,
        customHeight: Number(body.querySelector('#video-custom-h').value) || 720,
        fps: Number(body.querySelector('#video-fps').value)
      });
    });
  }

  // ---------------- Advanced ----------------
  function renderAdvanced(body) {
    const s = currentSettings.advanced;
    body.innerHTML = `
      <h2>Advanced</h2>
      <label>Automatically Reconnect
        <select id="adv-reconnect">${optionsHtml(['Enable', 'Disable'], s.autoReconnect ? 'Enable' : 'Disable')}</select>
      </label>
      <label>Network (bind interface / IP, optional)<input id="adv-network" type="text" value="${esc((s.network && s.network.bindIp) || '')}"></label>
      <div class="settings-actions">
        <button class="btn primary" id="settings-apply">Apply</button>
        <button class="btn" id="settings-cancel">Cancel</button>
      </div>`;
    wireApplyCancel(body, async () => {
      await Api.updateSettings('advanced', {
        autoReconnect: body.querySelector('#adv-reconnect').value === 'Enable',
        network: { bindIp: body.querySelector('#adv-network').value.trim() }
      });
    });
  }

  return { render };
})();
