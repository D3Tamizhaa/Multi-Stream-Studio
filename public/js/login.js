document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('login-error');
  errEl.hidden = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Login failed';
      errEl.hidden = false;
      return;
    }
    window.location.href = '/studio';
  } catch (err) {
    errEl.textContent = 'Could not reach the server';
    errEl.hidden = false;
  }
});

// If already logged in, skip straight to the studio.
fetch('/api/auth/me').then(r => { if (r.ok) window.location.href = '/studio'; }).catch(() => {});
