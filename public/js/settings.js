const SettingsUI = (() => {
  let caps = null;         // encoder capability map from server
  let serviceTemplates = null;

  async function loadCaps() {
    if (!caps) caps = await api.get('/api/settings/output/capabilities');
    return caps;
  }
  async function loadServiceTemplates() {
    if (!serviceTemplates) serviceTemplates = await api.get('/api/platforms/service-templates');
    return serviceTemplates;
  }

  function fillSelect(select, options, selected) {
    select.innerHTML = '';
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (opt === selected) o.selected = true;
      select.appendChild(o);
    }
  }

  // ---------------- Authorization ----------------
  function initAuth() {
    const form = document.getElementById('form-auth');
    const errEl = document.getElementById('auth-error');
    api.get('/api/auth/me').then(me => { document.getElementById('auth-username').value = me.username; });

    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      try {
        const res = await api.post('/api/auth/update', {
          username: document.getElementById('auth-username').value,
          currentPassword: document.getElementById('auth-current-password').value,
          newPassword: document.getElementById('auth-new-password').value
        });
        document.getElementById('username-label').textContent = res.username;
        document.getElementById('auth-current-password').value = '';
        document.getElementById('auth-new-password').value = '';
        App.goToView('editor');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    };
    form.querySelector('[data-cancel]').onclick = () => App.goToView('editor');
  }

  // ---------------- Stream (add platform) ----------------
  async function initStream() {
    const form = document.getElementById('form-stream');
    const serviceSel = document.getElementById('stream-service');
    const serverInput = document.getElementById('stream-server');
    const rtmpRow = document.getElementById('rtmp-name-row');
    const keyInput = document.getElementById('stream-key');
    const showBtn = document.getElementById('stream-key-show');
    const errEl = document.getElementById('stream-error');

    const templates = await loadServiceTemplates();

    function refresh() {
      const svc = serviceSel.value;
      if (svc === 'RTMP') {
        rtmpRow.hidden = false;
        serverInput.readOnly = false;
        serverInput.value = '';
      } else {
        rtmpRow.hidden = true;
        serverInput.readOnly = true;
        serverInput.value = templates[svc] || '';
      }
    }
    serviceSel.onchange = refresh;
    refresh();

    showBtn.onclick = () => {
      const show = keyInput.type === 'password';
      keyInput.type = show ? 'text' : 'password';
      showBtn.textContent = show ? 'Hide' : 'Show';
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      try {
        await api.post('/api/platforms', {
          service: serviceSel.value,
          server: serverInput.value,
          key: keyInput.value,
          rtmpServiceName: document.getElementById('stream-rtmp-name').value
        });
        form.reset();
        refresh();
        await App.reloadPlatforms();
        App.goToView('editor');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    };
    form.querySelector('[data-cancel]').onclick = () => App.goToView('editor');
  }

  // ---------------- Output ----------------
  async function initOutput() {
    const settings = (await api.get('/api/settings')).settings;
    const capabilities = await loadCaps();
    const out = settings.output;

    const modeSel = document.getElementById('output-mode');
    const simpleBox = document.getElementById('output-simple');
    const advBox = document.getElementById('output-advanced');
    modeSel.value = out.mode;

    function toggleMode() {
      simpleBox.hidden = modeSel.value !== 'simple';
      advBox.hidden = modeSel.value !== 'advanced';
    }
    modeSel.onchange = toggleMode;
    toggleMode();

    // Simple
    fillSelect(document.getElementById('simple-video-encoder'), Object.keys(capabilities.videoEncoders), out.simple.videoEncoder);
    fillSelect(document.getElementById('simple-audio-encoder'), Object.keys(capabilities.audioEncoders), out.simple.audioEncoder);
    fillSelect(document.getElementById('simple-preset'), ['Ultra Fast','Super Fast','Very Fast','Faster','Fast','Medium','Slow','Slower','Very Slow','Placebo'], out.simple.preset);
    document.getElementById('simple-video-bitrate').value = out.simple.videoBitrate;
    document.getElementById('simple-audio-bitrate').value = out.simple.audioBitrate;

    // Advanced
    const advVideoEncSel = document.getElementById('adv-video-encoder');
    const advRateSel = document.getElementById('adv-rate-control');
    const advPresetSel = document.getElementById('adv-preset');
    const advProfileSel = document.getElementById('adv-profile');
    const advTuneSel = document.getElementById('adv-tune');

    fillSelect(document.getElementById('adv-audio-encoder'), Object.keys(capabilities.audioEncoders), out.advanced.audio.encoder);
    document.getElementById('adv-audio-bitrate').value = out.advanced.audio.bitrate;
    fillSelect(advVideoEncSel, Object.keys(capabilities.videoEncoders), out.advanced.video.encoder);
    document.getElementById('adv-video-bitrate').value = out.advanced.video.bitrate;
    document.getElementById('adv-keyframe-interval').value = out.advanced.video.keyframeInterval;

    function refreshEncoderOptions() {
      const enc = capabilities.videoEncoders[advVideoEncSel.value];
      fillSelect(advRateSel, enc.rateControl.length ? enc.rateControl : ['None'], out.advanced.video.rateControl);
      fillSelect(advPresetSel, enc.preset.length ? [...enc.preset, 'None'] : ['None'], out.advanced.video.preset);
      fillSelect(advProfileSel, enc.profile.length ? [...enc.profile, 'None'] : ['None'], out.advanced.video.profile);
      fillSelect(advTuneSel, enc.tune.length ? [...enc.tune, 'None'] : ['None'], out.advanced.video.tune);
      const isCopy = enc.ffmpeg === 'copy';
      [advRateSel, advPresetSel, advProfileSel, advTuneSel, document.getElementById('adv-video-bitrate'), document.getElementById('adv-keyframe-interval')]
        .forEach(elm => elm.disabled = isCopy);
    }
    advVideoEncSel.onchange = refreshEncoderOptions;
    refreshEncoderOptions();

    document.getElementById('form-output').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        mode: modeSel.value,
        simple: {
          videoEncoder: document.getElementById('simple-video-encoder').value,
          videoBitrate: Number(document.getElementById('simple-video-bitrate').value),
          audioEncoder: document.getElementById('simple-audio-encoder').value,
          audioBitrate: Number(document.getElementById('simple-audio-bitrate').value),
          preset: document.getElementById('simple-preset').value
        },
        advanced: {
          video: {
            encoder: advVideoEncSel.value,
            rateControl: advRateSel.value,
            bitrate: Number(document.getElementById('adv-video-bitrate').value),
            keyframeInterval: Number(document.getElementById('adv-keyframe-interval').value),
            preset: advPresetSel.value,
            profile: advProfileSel.value,
            tune: advTuneSel.value
          },
          audio: {
            encoder: document.getElementById('adv-audio-encoder').value,
            bitrate: Number(document.getElementById('adv-audio-bitrate').value)
          }
        }
      };
      await api.put('/api/settings/output', payload);
      App.goToView('editor');
    };
    document.querySelector('#form-output [data-cancel]').onclick = () => App.goToView('editor');
  }

  // ---------------- Audio ----------------
  async function initAudio() {
    const settings = (await api.get('/api/settings')).settings;
    document.getElementById('audio-sample-rate').value = settings.audio.sampleRate;
    document.getElementById('audio-channels').value = settings.audio.channels;
    document.getElementById('form-audio').onsubmit = async (e) => {
      e.preventDefault();
      await api.put('/api/settings/audio', {
        sampleRate: Number(document.getElementById('audio-sample-rate').value),
        channels: document.getElementById('audio-channels').value
      });
      App.goToView('editor');
    };
    document.querySelector('#form-audio [data-cancel]').onclick = () => App.goToView('editor');
  }

  // ---------------- Video ----------------
  async function initVideo() {
    const settings = (await api.get('/api/settings')).settings;
    const resSel = document.getElementById('video-resolution');
    const customRow = document.getElementById('video-custom-row');
    resSel.value = settings.video.resolution === 'custom' ? 'custom' : settings.video.resolution;
    document.getElementById('video-custom-width').value = settings.video.customWidth;
    document.getElementById('video-custom-height').value = settings.video.customHeight;
    document.getElementById('video-fps').value = settings.video.fps;

    function toggleCustom() { customRow.hidden = resSel.value !== 'custom'; }
    resSel.onchange = toggleCustom;
    toggleCustom();

    document.getElementById('form-video').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        resolution: resSel.value,
        customWidth: Number(document.getElementById('video-custom-width').value),
        customHeight: Number(document.getElementById('video-custom-height').value),
        fps: Number(document.getElementById('video-fps').value)
      };
      await api.put('/api/settings/video', payload);
      await App.reloadCanvasSize();
      App.goToView('editor');
    };
    document.querySelector('#form-video [data-cancel]').onclick = () => App.goToView('editor');
  }

  // ---------------- Advanced ----------------
  async function initAdvanced() {
    const settings = (await api.get('/api/settings')).settings;
    document.getElementById('advanced-auto-reconnect').checked = !!settings.advanced.autoReconnect;
    document.getElementById('advanced-network').value = settings.advanced.network.bindIP || '';
    document.getElementById('form-advanced').onsubmit = async (e) => {
      e.preventDefault();
      await api.put('/api/settings/advanced', {
        autoReconnect: document.getElementById('advanced-auto-reconnect').checked,
        network: { bindIP: document.getElementById('advanced-network').value || 'default' }
      });
      App.goToView('editor');
    };
    document.querySelector('#form-advanced [data-cancel]').onclick = () => App.goToView('editor');
  }

  return { initAuth, initStream, initOutput, initAudio, initVideo, initAdvanced };
})();
