const Api = (() => {
  async function req(method, url, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  function upload(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || 'Upload failed'));
        } catch (e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  }

  return {
    login: (username, password) => req('POST', '/api/login', { username, password }),
    logout: () => req('POST', '/api/logout'),
    session: () => req('GET', '/api/session'),

    getEncoders: () => req('GET', '/api/encoders'),

    getScenes: () => req('GET', '/api/scenes'),
    addScene: name => req('POST', '/api/scenes', { name }),
    updateScene: (id, body) => req('PUT', `/api/scenes/${id}`, body),
    removeScene: id => req('DELETE', `/api/scenes/${id}`),
    activateScene: id => req('POST', `/api/scenes/${id}/activate`),
    moveScene: (id, direction) => req('POST', `/api/scenes/${id}/move`, { direction }),

    addSource: (sceneId, body) => req('POST', `/api/scenes/${sceneId}/sources`, body),
    updateSource: (sceneId, id, body) => req('PUT', `/api/scenes/${sceneId}/sources/${id}`, body),
    removeSource: (sceneId, id) => req('DELETE', `/api/scenes/${sceneId}/sources/${id}`),
    moveSource: (sceneId, id, direction) => req('POST', `/api/scenes/${sceneId}/sources/${id}/move`, { direction }),

    upload,

    getPlatforms: () => req('GET', '/api/platforms'),
    addPlatform: body => req('POST', '/api/platforms', body),
    updatePlatform: (id, body) => req('PUT', `/api/platforms/${id}`, body),
    removePlatform: id => req('DELETE', `/api/platforms/${id}`),

    getSettings: () => req('GET', '/api/settings'),
    updateSettings: (section, body) => req('PUT', `/api/settings/${section}`, body),
    updateAuthorization: body => req('PUT', '/api/settings/authorization', body),

    startStream: () => req('POST', '/api/stream/start'),
    stopStream: () => req('POST', '/api/stream/stop'),
    streamStatus: () => req('GET', '/api/stream/status')
  };
})();
