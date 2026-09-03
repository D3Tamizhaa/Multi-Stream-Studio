// App shell: side menu, view switching, header user menu.
const Views = {
  all: ['editor', 'settings-authorization', 'settings-stream', 'settings-output', 'settings-audio', 'settings-video', 'settings-advanced'],
  current: 'editor',
  show(name) {
    if (!Views.all.includes(name)) name = 'editor';
    Views.all.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.hidden = v !== name;
    });
    Views.current = name;
    closeMenu();
    document.dispatchEvent(new CustomEvent('view:show', { detail: { view: name } }));
  }
};

const sideMenu = document.getElementById('side-menu');
const menuBackdrop = document.getElementById('menu-backdrop');

function openMenu() { sideMenu.hidden = false; menuBackdrop.hidden = false; }
function closeMenu() { sideMenu.hidden = true; menuBackdrop.hidden = true; }

document.getElementById('menu-btn').addEventListener('click', () => {
  sideMenu.hidden ? openMenu() : closeMenu();
});
menuBackdrop.addEventListener('click', closeMenu);

sideMenu.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-view]');
  if (li) Views.show(li.dataset.view);
});

document.querySelectorAll('[data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => Views.show(btn.dataset.nav));
});

document.getElementById('username-btn').addEventListener('click', () => Views.show('settings-authorization'));

document.getElementById('logout-btn').addEventListener('click', async () => {
  await API.post('/api/auth/logout');
  window.location.href = '/login.html';
});

(async function initHeader() {
  try {
    const me = await API.get('/api/auth/me');
    document.getElementById('username-btn').textContent = me.username;
  } catch (_) { /* redirected to login already by api.js */ }
})();
