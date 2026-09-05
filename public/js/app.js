const App = (() => {
  let username = 'admin';
  let currentRoute = 'editor';
  let statusTimer = null;

  function currentUsername() { return username; }
  function setUsername(u) { username = u; document.getElementById('username-label').textContent = u; }

  async function boot() {
    try {
      const s = await Api.session();
      setUsername(s.username);
      showApp();
    } catch {
      showLogin();
    }
    wireLogin();
    wireHeader();
  }

  function showLogin() {
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('view-app').classList.add('hidden');
  }
  async function showApp() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-app').classList.remove('hidden');
    Editor.wireToolbars();
    await Editor.loadAll();
    wireControls();
    navigate('editor');
    startStatusPolling();
  }

  function wireLogin() {
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      const err = document.getElementById('login-error');
      err.textContent = '';
      try {
        const r = await Api.login(u, p);
        setUsername(r.username);
        showApp();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  function wireHeader() {
    document.getElementById('menu-btn').addEventListener('click', () => {
      document.getElementById('side-menu').classList.toggle('hidden');
    });
    document.querySelectorAll('#side-menu a[data-route]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('side-menu').classList.add('hidden');
        navigate(a.dataset.route);
      });
    });
    document.getElementById('user-menu-btn').addEventListener('click', () => {
      document.getElementById('user-menu-dropdown').classList.toggle('hidden');
    });
    document.getElementById('user-menu-auth').addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('user-menu-dropdown').classList.add('hidden');
      navigate('settings/authorization');
    });
    document.getElementById('user-menu-logout').addEventListener('click', async e => {
      e.preventDefault();
      await Api.logout();
      stopStatusPolling();
      showLogin();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.user-menu')) document.getElementById('user-menu-dropdown').classList.add('hidden');
    });
  }

  function navigate(route) {
    currentRoute = route;
    const isSettings = route.startsWith('settings/');
    document.getElementById('route-editor').classList.toggle('hidden', isSettings);
    document.getElementById('route-settings').classList.toggle('hidden', !isSettings);
    if (isSettings) {
      Settings.render(route.split('/')[1]);
    } else {
      Editor.renderAll();
    }
  }

  function wireControls() {
    document.getElementById('btn-start-stream').addEventListener('click', async () => {
      const btn = document.getElementById('btn-start-stream');
      btn.disabled = true;
      try {
        await Api.startStream();
      } catch (e) { alert(e.message); }
      btn.disabled = false;
    });
    document.getElementById('btn-stop-stream').addEventListener('click', async () => {
      await Api.stopStream();
    });
  }

  function fmtUptime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function startStatusPolling() {
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = setInterval(async () => {
      try {
        const st = await Api.streamStatus();
        document.getElementById('status-uptime').textContent = fmtUptime(st.uptimeSeconds);
        document.getElementById('status-text').textContent = st.status.charAt(0).toUpperCase() + st.status.slice(1) + (st.lastError ? ` (${st.lastError})` : '');
        const running = st.status === 'starting' || st.status === 'live';
        document.getElementById('btn-start-stream').disabled = running;
        document.getElementById('btn-stop-stream').disabled = !running;
      } catch { /* ignore transient errors */ }
    }, 1500);
  }
  function stopStatusPolling() { if (statusTimer) clearInterval(statusTimer); statusTimer = null; }

  return { boot, navigate, currentUsername, setUsername };
})();

document.addEventListener('DOMContentLoaded', App.boot);
