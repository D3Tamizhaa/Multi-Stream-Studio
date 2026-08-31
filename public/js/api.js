const api = {
  async _req(method, url, body, opts = {}) {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      ...opts,
    });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      if (res.status === 401 && !opts.skipAuthRedirect) {
        window.location.href = '/login.html';
      }
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  },
  get(url, opts) { return this._req('GET', url, null, opts); },
  post(url, body, opts) { return this._req('POST', url, body, opts); },
  put(url, body, opts) { return this._req('PUT', url, body, opts); },
  del(url, opts) { return this._req('DELETE', url, null, opts); },
};
