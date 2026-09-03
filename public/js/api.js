// Minimal fetch wrapper - JSON in, JSON out, throws on non-2xx with the
// server's { error } message so callers can just try/catch.
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }
  let data = null;
  try { data = await res.json(); } catch (_) { /* empty body */ }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

const API = {
  get: (url) => api('GET', url),
  post: (url, body) => api('POST', url, body),
  put: (url, body) => api('PUT', url, body),
  patch: (url, body) => api('PATCH', url, body),
  del: (url) => api('DELETE', url)
};
