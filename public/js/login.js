document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const data = await api.post('/api/auth/login', { username, password });
    window.appBoot(data.username);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
