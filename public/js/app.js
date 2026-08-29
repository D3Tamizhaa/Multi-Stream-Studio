function showToast(message, type) {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type || ''}`.trim();
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}
window.showToast = showToast;

function showEditorView() {
  document.getElementById('settings-view').classList.remove('active');
  document.getElementById('app-view').classList.remove('hidden');
}
function showSettingsView(tab) {
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('settings-view').classList.add('active');
  window.settingsModule.openTab(tab || 'authorization');
}
window.showEditorView = showEditorView;
window.showSettingsView = showSettingsView;

function fmtUptime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function applyStats(payload) {
  const live = payload.live;
  const stats = payload.stats || {};
  document.getElementById('stat-uptime').textContent = fmtUptime(stats.uptimeSec);
  document.getElementById('stat-bitrate').textContent = `${Math.round(stats.bitrateKbps || 0)} kbit/s`;
  document.getElementById('stat-fps').textContent = `${Math.round(stats.fps || 0)}`;
  document.getElementById('stat-cpu').textContent = `${Math.round(stats.cpuPercent || 0)}%`;
  document.getElementById('stat-ram').textContent = `${Math.round(stats.ramPercent || 0)}%`;

  const pill = document.getElementById('status-live-pill');
  const text = document.getElementById('status-text');
  pill.classList.toggle('live', live);
  text.textContent = live ? 'Live' : (stats.status === 'error' ? 'Error' : 'Idle');

  document.getElementById('app-view').classList.toggle('is-live', live);
  const goLiveBtn = document.getElementById('go-live-btn');
  goLiveBtn.textContent = live ? 'End Streaming' : 'Start Streaming';
  goLiveBtn.classList.toggle('live', live);
  window.editorModule.setLiveState(live);
}

function connectStatsSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws/stats`);
  ws.onmessage = (evt) => {
    try {
      const payload = JSON.parse(evt.data);
      if (payload.type === 'stats') applyStats(payload);
    } catch (e) { /* ignore malformed frame */ }
  };
  ws.onclose = () => setTimeout(connectStatsSocket, 2000);
}

function wireHeader() {
  const menuBtn = document.getElementById('menu-btn');
  const menuDropdown = document.getElementById('menu-dropdown');
  const userChip = document.getElementById('user-chip');
  const userDropdown = document.getElementById('user-dropdown');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.add('hidden');
    menuDropdown.classList.toggle('hidden');
  });
  userChip.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.add('hidden');
    userDropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    menuDropdown.classList.add('hidden');
    userDropdown.classList.add('hidden');
  });

  menuDropdown.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); showEditorView(); });
  });
  menuDropdown.querySelectorAll('[data-settings-tab]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); showSettingsView(el.dataset.settingsTab); });
  });

  // Clicking the username redirects to Authorization settings.
  document.getElementById('username-label').addEventListener('click', () => showSettingsView('authorization'));
  document.getElementById('goto-authorization').addEventListener('click', () => showSettingsView('authorization'));

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    location.reload();
  });
}

window.appBoot = function appBoot(username) {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  document.getElementById('username-label').textContent = username;
  document.getElementById('avatar-initial').textContent = username.slice(0, 1).toUpperCase();
  wireHeader();
  window.editorModule.init();
  window.settingsModule.init();
  connectStatsSocket();
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await api.get('/api/auth/me');
    window.appBoot(me.username);
  } catch (e) {
    // not logged in — login view is visible by default
  }
});
