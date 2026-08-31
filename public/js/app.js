// ---- Auth guard ----
let CURRENT_USER = null;

async function boot() {
  try {
    CURRENT_USER = await api.get('/api/auth/me', { skipAuthRedirect: true });
  } catch {
    window.location.href = '/login.html';
    return;
  }
  document.getElementById('header-username').textContent = CURRENT_USER.username;
  wireHeader();
  wireMenu();
  wireSocket();
  showView('editor');
  if (window.EditorModule) window.EditorModule.init();
  if (window.SettingsModule) window.SettingsModule.init();
}

function wireHeader() {
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userMenu = document.getElementById('user-menu');
  userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => userMenu.classList.add('hidden'));

  document.getElementById('user-menu-username').addEventListener('click', () => {
    userMenu.classList.add('hidden');
    showView('settings-authorization');
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    window.location.href = '/login.html';
  });
}

function wireMenu() {
  const menuBtn = document.getElementById('menu-btn');
  const sideMenu = document.getElementById('side-menu');
  const overlay = document.getElementById('menu-overlay');

  const open = () => { sideMenu.classList.remove('hidden'); overlay.classList.remove('hidden'); };
  const close = () => { sideMenu.classList.add('hidden'); overlay.classList.add('hidden'); };

  menuBtn.addEventListener('click', open);
  overlay.addEventListener('click', close);

  document.querySelectorAll('.menu-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.view);
      close();
    });
  });
}

function showView(view) {
  const editorView = document.getElementById('view-editor');
  const settingsView = document.getElementById('view-settings');

  if (view === 'editor') {
    editorView.classList.remove('hidden');
    settingsView.classList.add('hidden');
    if (window.EditorModule) window.EditorModule.refreshAll();
  } else if (view.startsWith('settings-')) {
    editorView.classList.add('hidden');
    settingsView.classList.remove('hidden');
    const section = view.replace('settings-', '');
    if (window.SettingsModule) window.SettingsModule.showSection(section);
  }
}

function wireSocket() {
  const socket = io({ withCredentials: true });
  socket.on('stream:status', (status) => {
    if (window.EditorModule) window.EditorModule.applyStatus(status);
  });
}

// expose for other modules
window.showView = showView;

document.addEventListener('DOMContentLoaded', boot);
