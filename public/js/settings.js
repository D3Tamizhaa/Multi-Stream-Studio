window.settingsModule = (() => {
  let settings = null;
  let encoders = null;
  let currentTab = 'authorization';

  const el = (id) => document.getElementById(id);
  const SERVICE_SERVERS = {
    YouTube: 'rtmp://a.rtmp.youtube.com/live2',
    Facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
    Twitch: 'rtmp://live.twitch.tv/app',
    Kick: 'rtmp://fa723fc1b171.global-contribute.live-video.net/live'
  };

  function openTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.settings-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.settings-section').forEach((s) => s.classList.toggle('hidden', s.dataset.panel !== tab));
    document.querySelector('.settings-footer').classList.toggle('hidden', tab === 'authorization' || tab === 'stream');
    if (tab === 'authorization') loadAuthorization();
    if (tab === 'stream') resetStreamForm();
  }

  document.querySelectorAll('.settings-nav-btn').forEach((btn) => btn.addEventListener('click', () => openTab(btn.dataset.tab)));

  // ---------------- load / populate ----------------
  async function loadAll() {
    const [s, e] = await Promise.all([api.get('/api/settings'), api.get('/api/settings/encoders')]);
    settings = s.settings;
    encoders = e;
    populateEncoderSelects();
    populateFormFromSettings();
  }

  function populateEncoderSelects() {
    const videoNames = Object.keys(encoders.video);
    fillSelect('simple-video-encoder', videoNames);
    fillSelect('adv-video-encoder', videoNames);
    fillSelect('simple-audio-encoder', encoders.audio);
    fillSelect('adv-audio-encoder', encoders.audio);
    fillSelect('simple-preset', ['Ultra Fast', 'Very Fast', 'Fast', 'Medium', 'Slow']);
  }

  function fillSelect(id, values) {
    const sel = el(id);
    sel.innerHTML = values.map((v) => `<option>${v}</option>`).join('');
  }

  function refreshAdvancedEncoderDependentFields() {
    const encName = el('adv-video-encoder').value;
    const meta = encoders.video[encName];
    if (!meta) return;
    fillSelect('adv-rate-control', meta.rateControl);
    fillSelect('adv-preset', meta.presets.length ? meta.presets : ['None']);
    fillSelect('adv-profile', (meta.profiles.length ? meta.profiles : ['None']).concat(meta.profiles.length ? ['None'] : []));
    fillSelect('adv-tune', meta.tunes.length ? meta.tunes.concat(['None']) : ['None']);
    el('adv-preset-field').classList.toggle('hidden', !meta.presets.length);
    el('adv-profile-field').classList.toggle('hidden', !meta.profiles.length);
    el('adv-tune-field').classList.toggle('hidden', !meta.tunes.length);
    el('adv-keyframe').closest('.field').classList.toggle('hidden', !meta.keyframeInterval);
    onRateControlChange();
  }

  function onRateControlChange() {
    const rc = el('adv-rate-control').value;
    const isQuality = ['CRF', 'QP', 'CQ'].includes(rc);
    el('adv-bitrate-field').classList.toggle('hidden', isQuality);
    el('adv-quality-field').classList.toggle('hidden', !isQuality);
  }

  el('adv-video-encoder').addEventListener('change', refreshAdvancedEncoderDependentFields);
  el('adv-rate-control').addEventListener('change', onRateControlChange);

  function populateFormFromSettings() {
    const out = settings.output;
    document.querySelectorAll('#output-mode-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.mode === out.mode));
    el('output-simple').classList.toggle('hidden', out.mode !== 'Simple');
    el('output-advanced').classList.toggle('hidden', out.mode !== 'Advanced');

    el('simple-video-encoder').value = out.simple.videoEncoder;
    el('simple-video-bitrate').value = out.simple.videoBitrate;
    el('simple-audio-encoder').value = out.simple.audioEncoder;
    el('simple-audio-bitrate').value = out.simple.audioBitrate;
    el('simple-preset').value = out.simple.preset;

    el('adv-video-encoder').value = out.advanced.video.encoder;
    refreshAdvancedEncoderDependentFields();
    el('adv-rate-control').value = out.advanced.video.rateControl;
    onRateControlChange();
    el('adv-bitrate').value = out.advanced.video.bitrate || 2500;
    el('adv-quality').value = out.advanced.video.quality != null ? out.advanced.video.quality : 23;
    el('adv-keyframe').value = out.advanced.video.keyframeInterval || 2;
    if (out.advanced.video.preset) el('adv-preset').value = out.advanced.video.preset;
    if (out.advanced.video.profile) el('adv-profile').value = out.advanced.video.profile;
    if (out.advanced.video.tune) el('adv-tune').value = out.advanced.video.tune;
    el('adv-audio-encoder').value = out.advanced.audio.encoder;
    el('adv-audio-bitrate').value = out.advanced.audio.bitrate;

    el('audio-sample-rate').value = settings.audio.sampleRate;
    el('audio-channels').value = settings.audio.channels;

    el('video-base-res').value = settings.video.baseResolution;
    el('video-base-w').value = settings.video.baseCustom.width;
    el('video-base-h').value = settings.video.baseCustom.height;
    el('video-base-custom').classList.toggle('hidden', settings.video.baseResolution !== 'Custom');

    el('video-out-res').value = settings.video.outputResolution;
    el('video-out-w').value = settings.video.outputCustom.width;
    el('video-out-h').value = settings.video.outputCustom.height;
    el('video-out-custom').classList.toggle('hidden', settings.video.outputResolution !== 'Custom');

    el('video-fps').value = String(settings.video.fps);

    el('adv-reconnect').checked = !!settings.advanced.autoReconnect;
    el('adv-network-iface').value = settings.advanced.network.interfaceName || '';
  }

  document.querySelectorAll('#output-mode-toggle button').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('#output-mode-toggle button').forEach((b) => b.classList.toggle('active', b === btn));
    el('output-simple').classList.toggle('hidden', btn.dataset.mode !== 'Simple');
    el('output-advanced').classList.toggle('hidden', btn.dataset.mode !== 'Advanced');
  }));
  el('video-base-res').addEventListener('change', () => el('video-base-custom').classList.toggle('hidden', el('video-base-res').value !== 'Custom'));
  el('video-out-res').addEventListener('change', () => el('video-out-custom').classList.toggle('hidden', el('video-out-res').value !== 'Custom'));

  // ---------------- apply / cancel ----------------
  el('settings-apply').addEventListener('click', async () => {
    try {
      const outMode = document.querySelector('#output-mode-toggle button.active').dataset.mode;
      await api.put('/api/settings/output', {
        mode: outMode,
        simple: {
          videoEncoder: el('simple-video-encoder').value,
          videoBitrate: Number(el('simple-video-bitrate').value),
          audioEncoder: el('simple-audio-encoder').value,
          audioBitrate: Number(el('simple-audio-bitrate').value),
          preset: el('simple-preset').value
        },
        advanced: {
          audio: { encoder: el('adv-audio-encoder').value, bitrate: Number(el('adv-audio-bitrate').value) },
          video: {
            encoder: el('adv-video-encoder').value,
            rateControl: el('adv-rate-control').value,
            bitrate: Number(el('adv-bitrate').value),
            quality: Number(el('adv-quality').value),
            keyframeInterval: Number(el('adv-keyframe').value),
            preset: el('adv-preset').value,
            profile: el('adv-profile').value,
            tune: el('adv-tune').value
          }
        }
      });
      await api.put('/api/settings/audio', { sampleRate: el('audio-sample-rate').value, channels: el('audio-channels').value });
      await api.put('/api/settings/video', {
        baseResolution: el('video-base-res').value,
        baseCustom: { width: Number(el('video-base-w').value), height: Number(el('video-base-h').value) },
        outputResolution: el('video-out-res').value,
        outputCustom: { width: Number(el('video-out-w').value), height: Number(el('video-out-h').value) },
        fps: Number(el('video-fps').value)
      });
      await api.put('/api/settings/advanced', {
        autoReconnect: el('adv-reconnect').checked,
        network: { interfaceName: el('adv-network-iface').value }
      });
      showToast('Settings applied.', 'success');
      window.editorModule.refreshBaseRes();
      window.showEditorView();
    } catch (e) { showToast(e.message, 'error'); }
  });
  el('settings-cancel').addEventListener('click', () => { populateFormFromSettings(); window.showEditorView(); });

  // ---------------- authorization ----------------
  async function loadAuthorization() {
    try {
      const me = await api.get('/api/auth/me');
      el('auth-username').value = me.username;
      el('auth-password').value = '';
    } catch (e) { /* ignore */ }
  }
  el('auth-update').addEventListener('click', async () => {
    const username = el('auth-username').value.trim();
    const password = el('auth-password').value;
    try {
      await api.put('/api/auth/credentials', { username: username || undefined, password: password || undefined });
      document.getElementById('username-label').textContent = username;
      document.getElementById('avatar-initial').textContent = username.slice(0, 1).toUpperCase();
      showToast('Credentials updated.', 'success');
      window.showEditorView();
    } catch (e) { showToast(e.message, 'error'); }
  });
  el('auth-cancel').addEventListener('click', () => window.showEditorView());

  // ---------------- stream (add platform) ----------------
  function resetStreamForm() {
    el('stream-service').value = 'YouTube';
    updateStreamServiceUI();
  }
  function updateStreamServiceUI() {
    const service = el('stream-service').value;
    const isRtmp = service === 'RTMP';
    el('stream-name-field').classList.toggle('hidden', !isRtmp);
    el('stream-server').readOnly = !isRtmp;
    el('stream-server').value = isRtmp ? '' : (SERVICE_SERVERS[service] || '');
    el('stream-key').value = '';
    el('stream-key').type = 'password';
  }
  el('stream-service').addEventListener('change', updateStreamServiceUI);
  el('stream-key-show').addEventListener('click', () => {
    const f = el('stream-key');
    f.type = f.type === 'password' ? 'text' : 'password';
  });
  el('stream-add-service').addEventListener('click', async () => {
    const service = el('stream-service').value;
    try {
      const payload = { service, streamKey: el('stream-key').value };
      if (service === 'RTMP') { payload.name = el('stream-name').value.trim(); payload.server = el('stream-server').value.trim(); }
      await api.post('/api/platforms', payload);
      showToast('Platform added.', 'success');
      window.editorModule.refreshPlatforms();
      window.showEditorView();
    } catch (e) { showToast(e.message, 'error'); }
  });
  el('stream-cancel').addEventListener('click', () => window.showEditorView());

  return {
    init() { loadAll(); },
    openTab
  };
})();
