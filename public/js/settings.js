// Settings pages: Authorization / Stream / Output / Audio / Video / Advanced.

// ---------------------------------------------------------------- Authorization
document.getElementById('form-authorization').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('auth-error');
  errorEl.hidden = true;
  try {
    await API.post('/api/auth/authorization', {
      username: document.getElementById('auth-username').value.trim() || undefined,
      currentPassword: document.getElementById('auth-current-password').value,
      newPassword: document.getElementById('auth-new-password').value || undefined
    });
    document.getElementById('username-btn').textContent = document.getElementById('auth-username').value.trim() || document.getElementById('username-btn').textContent;
    document.getElementById('auth-current-password').value = '';
    document.getElementById('auth-new-password').value = '';
    Views.show('editor');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

document.addEventListener('view:show', async (e) => {
  if (e.detail.view === 'settings-authorization') {
    const me = await API.get('/api/auth/me');
    document.getElementById('auth-username').value = me.username;
  }
});

// ---------------------------------------------------------------- Stream
let SERVICE_DEFAULTS = {};
const serviceSelect = document.getElementById('stream-service');
const serverInput = document.getElementById('stream-server');
const serviceNameRow = document.getElementById('stream-servicename-row');
const keyInput = document.getElementById('stream-key');
const keyToggle = document.getElementById('stream-key-toggle');
const submitBtn = document.getElementById('stream-submit-btn');

keyToggle.addEventListener('click', () => {
  const show = keyInput.type === 'password';
  keyInput.type = show ? 'text' : 'password';
  keyToggle.textContent = show ? 'Hide' : 'Show';
});

function applyServiceDefault() {
  const service = serviceSelect.value;
  if (service === 'rtmp') {
    serviceNameRow.hidden = false;
    serverInput.readOnly = false;
    serverInput.value = '';
    serverInput.placeholder = 'rtmp://your-server/app';
  } else {
    serviceNameRow.hidden = true;
    serverInput.readOnly = true;
    serverInput.value = (SERVICE_DEFAULTS[service] && SERVICE_DEFAULTS[service].server) || '';
  }
}
serviceSelect.addEventListener('change', applyServiceDefault);

async function resetStreamForm(existing) {
  const errorEl = document.getElementById('stream-error');
  errorEl.hidden = true;
  keyInput.type = 'password';
  keyToggle.textContent = 'Show';
  if (existing) {
    serviceSelect.value = existing.service;
    serviceSelect.disabled = true; // service can't be changed once created
    applyServiceDefault();
    if (existing.service === 'rtmp') {
      document.getElementById('stream-servicename').value = existing.name;
      serverInput.value = existing.server;
      serverInput.readOnly = false;
    }
    keyInput.value = existing.streamKey || '';
    submitBtn.textContent = 'Update Service';
  } else {
    serviceSelect.disabled = false;
    serviceSelect.value = 'youtube';
    document.getElementById('stream-servicename').value = '';
    keyInput.value = '';
    applyServiceDefault();
    submitBtn.textContent = 'Add Service';
  }
}

document.addEventListener('platform:edit', (e) => resetStreamForm(e.detail));
document.addEventListener('view:show', async (e) => {
  if (e.detail.view === 'settings-stream') {
    if (Object.keys(SERVICE_DEFAULTS).length === 0) {
      SERVICE_DEFAULTS = await API.get('/api/platforms/service-defaults');
    }
    if (!EditorState.editingPlatformId) resetStreamForm(null);
  }
});

document.getElementById('form-stream').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('stream-error');
  errorEl.hidden = true;
  const service = serviceSelect.value;
  const payload = {
    service,
    server: serverInput.value,
    streamKey: keyInput.value,
    customName: document.getElementById('stream-servicename').value.trim()
  };
  try {
    if (EditorState.editingPlatformId) {
      await API.patch(`/api/platforms/${EditorState.editingPlatformId}`, payload);
    } else {
      await API.post('/api/platforms', payload);
    }
    EditorState.editingPlatformId = null;
    Views.show('editor');
    loadPlatforms();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

// ---------------------------------------------------------------- Output
let CAPS = null;
function fillSelect(sel, options, current) {
  sel.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join('');
  if (current && options.includes(current)) sel.value = current;
}

async function loadOutputSettings() {
  if (!CAPS) CAPS = await API.get('/api/settings/output/capabilities');
  const data = await API.get('/api/settings');
  const out = data.output;

  document.getElementById('output-mode').value = out.mode;
  fillSelect(document.getElementById('simple-video-encoder'), CAPS.videoEncoders, out.simple.videoEncoder);
  document.getElementById('simple-video-bitrate').value = out.simple.videoBitrate;
  fillSelect(document.getElementById('simple-audio-encoder'), CAPS.audioEncoders, out.simple.audioEncoder);
  document.getElementById('simple-audio-bitrate').value = out.simple.audioBitrate;
  fillSelect(document.getElementById('simple-preset'), CAPS.encoderInfo[out.simple.videoEncoder].preset, out.simple.preset);

  fillSelect(document.getElementById('adv-video-encoder'), CAPS.videoEncoders, out.advanced.video.encoder);
  fillSelect(document.getElementById('adv-audio-encoder'), CAPS.audioEncoders, out.advanced.audio.encoder);
  document.getElementById('adv-audio-bitrate').value = out.advanced.audio.bitrate;
  document.getElementById('adv-video-bitrate').value = out.advanced.video.bitrate;
  document.getElementById('adv-keyframe').value = out.advanced.video.keyframeInterval;
  refreshAdvancedVideoOptions(out.advanced.video);

  toggleOutputMode();
}

function refreshAdvancedVideoOptions(current) {
  const encoder = document.getElementById('adv-video-encoder').value;
  const info = CAPS.encoderInfo[encoder];
  fillSelect(document.getElementById('adv-rate-control'), info.rateControl, current && current.rateControl);
  fillSelect(document.getElementById('adv-preset'), info.preset, current && current.preset);
  fillSelect(document.getElementById('adv-profile'), info.profile, current && current.profile);
  fillSelect(document.getElementById('adv-tune'), info.tune, current && current.tune);
  document.getElementById('adv-keyframe-row').style.display = info.keyframeInterval ? '' : 'none';
  const rc = document.getElementById('adv-rate-control').value;
  const label = document.getElementById('adv-bitrate-label');
  const labelText = { CRF: 'CRF Value', QP: 'QP Value', CQ: 'CQ Value', None: 'Bitrate (unused)' }[rc] || 'Bitrate (kbps)';
  label.firstChild.textContent = labelText + ' ';
}

document.getElementById('adv-video-encoder').addEventListener('change', () => refreshAdvancedVideoOptions(null));
document.getElementById('adv-rate-control').addEventListener('change', () => refreshAdvancedVideoOptions({
  rateControl: document.getElementById('adv-rate-control').value,
  preset: document.getElementById('adv-preset').value,
  profile: document.getElementById('adv-profile').value,
  tune: document.getElementById('adv-tune').value
}));
document.getElementById('simple-video-encoder').addEventListener('change', () => {
  fillSelect(document.getElementById('simple-preset'), CAPS.encoderInfo[document.getElementById('simple-video-encoder').value].preset);
});

function toggleOutputMode() {
  const mode = document.getElementById('output-mode').value;
  document.getElementById('output-simple').hidden = mode !== 'simple';
  document.getElementById('output-advanced').hidden = mode !== 'advanced';
}
document.getElementById('output-mode').addEventListener('change', toggleOutputMode);

document.getElementById('output-apply-btn').addEventListener('click', async () => {
  const mode = document.getElementById('output-mode').value;
  const payload = {
    mode,
    simple: {
      videoEncoder: document.getElementById('simple-video-encoder').value,
      videoBitrate: Number(document.getElementById('simple-video-bitrate').value),
      audioEncoder: document.getElementById('simple-audio-encoder').value,
      audioBitrate: Number(document.getElementById('simple-audio-bitrate').value),
      preset: document.getElementById('simple-preset').value
    },
    advanced: {
      video: {
        encoder: document.getElementById('adv-video-encoder').value,
        rateControl: document.getElementById('adv-rate-control').value,
        bitrate: Number(document.getElementById('adv-video-bitrate').value),
        keyframeInterval: Number(document.getElementById('adv-keyframe').value),
        preset: document.getElementById('adv-preset').value,
        profile: document.getElementById('adv-profile').value,
        tune: document.getElementById('adv-tune').value
      },
      audio: {
        encoder: document.getElementById('adv-audio-encoder').value,
        bitrate: Number(document.getElementById('adv-audio-bitrate').value)
      }
    }
  };
  await API.put('/api/settings/output', payload);
  Views.show('editor');
});

document.addEventListener('view:show', (e) => { if (e.detail.view === 'settings-output') loadOutputSettings(); });

// ---------------------------------------------------------------- Audio
async function loadAudioSettings() {
  const data = await API.get('/api/settings');
  document.getElementById('audio-sample-rate').value = data.audio.sampleRate;
  document.getElementById('audio-channels').value = data.audio.channels;
}
document.getElementById('audio-apply-btn').addEventListener('click', async () => {
  await API.put('/api/settings/audio', {
    sampleRate: Number(document.getElementById('audio-sample-rate').value),
    channels: document.getElementById('audio-channels').value
  });
  Views.show('editor');
});
document.addEventListener('view:show', (e) => { if (e.detail.view === 'settings-audio') loadAudioSettings(); });

// ---------------------------------------------------------------- Video
async function loadVideoSettings() {
  const data = await API.get('/api/settings');
  document.getElementById('video-resolution').value = data.video.resolution;
  document.getElementById('video-custom-width').value = data.video.customWidth;
  document.getElementById('video-custom-height').value = data.video.customHeight;
  document.getElementById('video-fps').value = data.video.fps;
  document.getElementById('video-custom-row').hidden = data.video.resolution !== 'Custom';
}
document.getElementById('video-resolution').addEventListener('change', (e) => {
  document.getElementById('video-custom-row').hidden = e.target.value !== 'Custom';
});
document.getElementById('video-apply-btn').addEventListener('click', async () => {
  await API.put('/api/settings/video', {
    resolution: document.getElementById('video-resolution').value,
    customWidth: Number(document.getElementById('video-custom-width').value) || 1280,
    customHeight: Number(document.getElementById('video-custom-height').value) || 720,
    fps: Number(document.getElementById('video-fps').value)
  });
  Views.show('editor');
});
document.addEventListener('view:show', (e) => { if (e.detail.view === 'settings-video') loadVideoSettings(); });

// ---------------------------------------------------------------- Advanced
async function loadAdvancedSettings() {
  const data = await API.get('/api/settings');
  document.getElementById('advanced-reconnect').value = String(data.advanced.autoReconnect);
  document.getElementById('advanced-network-ip').value = (data.advanced.network && data.advanced.network.bindIp) || '';
}
document.getElementById('advanced-apply-btn').addEventListener('click', async () => {
  await API.put('/api/settings/advanced', {
    autoReconnect: document.getElementById('advanced-reconnect').value === 'true',
    network: { bindIp: document.getElementById('advanced-network-ip').value }
  });
  Views.show('editor');
});
document.addEventListener('view:show', (e) => { if (e.detail.view === 'settings-advanced') loadAdvancedSettings(); });
