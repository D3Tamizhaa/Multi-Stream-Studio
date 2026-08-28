// Workspace: the live editing area + the offscreen canvas compositor that
// produces the actual video frames sent to the server for FFmpeg to encode.
const Workspace = (() => {
  const el = () => document.getElementById('workspace');
  let currentScene = null;     // {id, name, sources: [...]}
  let selectedSourceId = null;
  let baseRes = { width: 1920, height: 1080 };

  // Offscreen composite canvas at the configured base resolution.
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const mediaCache = new Map(); // sourceId -> HTMLImageElement | HTMLVideoElement
  let rafId = null;

  function setBaseResolution(w, h) {
    baseRes = { width: w, height: h };
    canvas.width = w;
    canvas.height = h;
  }

  function loadScene(scene) {
    currentScene = scene;
    selectedSourceId = null;
    render();
  }

  function getScene() { return currentScene; }
  function getSelected() { return currentScene ? currentScene.sources.find(s => s.id === selectedSourceId) : null; }

  function render() {
    const container = el();
    container.innerHTML = '';
    if (!currentScene) return;
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / baseRes.width;
    const scaleY = rect.height / baseRes.height;

    currentScene.sources.forEach(src => {
      if (src.visible === false) return;
      const node = document.createElement('div');
      node.className = 'ws-source' + (src.id === selectedSourceId ? ' selected' : '');
      node.style.left = (src.x * scaleX) + 'px';
      node.style.top = (src.y * scaleY) + 'px';
      node.style.width = (src.width * scaleX) + 'px';
      node.style.height = (src.height * scaleY) + 'px';
      node.dataset.id = src.id;

      if (src.type === 'Image' && src.props.url) {
        const img = document.createElement('img'); img.src = src.props.url; node.appendChild(img);
      } else if (src.type === 'Media' && src.props.url) {
        const v = document.createElement('video'); v.src = src.props.url; v.muted = false; v.loop = !!src.props.loop; v.autoplay = true; v.playsInline = true; node.appendChild(v);
      } else if (src.type === 'Text') {
        const t = document.createElement('div');
        t.textContent = src.props.text || '';
        t.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${src.props.color || '#ffffff'};font-family:${src.props.fontFamily || 'sans-serif'};font-size:${(src.props.fontSize || 32) * scaleY}px;`;
        node.appendChild(t);
      } else if (src.type === 'Browser Source' && src.props.url) {
        const iframe = document.createElement('iframe');
        iframe.src = src.props.url; iframe.style.border = 'none';
        if (src.props.customCSS) {
          iframe.onload = () => { try { const doc = iframe.contentDocument; const style = doc.createElement('style'); style.textContent = src.props.customCSS; doc.head.appendChild(style); } catch (e) {} };
        }
        node.appendChild(iframe);
      }

      if (!src.locked) {
        node.addEventListener('mousedown', (e) => startDrag(e, src, scaleX, scaleY));
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.addEventListener('mousedown', (e) => { e.stopPropagation(); startResize(e, src, scaleX, scaleY); });
        node.appendChild(handle);
      }
      node.addEventListener('click', () => { selectedSourceId = src.id; render(); document.dispatchEvent(new CustomEvent('ws:select', { detail: src.id })); });

      container.appendChild(node);
    });
  }

  function startDrag(e, src, scaleX, scaleY) {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origX = src.x, origY = src.y;
    function onMove(ev) {
      src.x = Math.max(0, origX + (ev.clientX - startX) / scaleX);
      src.y = Math.max(0, origY + (ev.clientY - startY) / scaleY);
      render();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.dispatchEvent(new CustomEvent('ws:sourcechange', { detail: src }));
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startResize(e, src, scaleX, scaleY) {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origW = src.width, origH = src.height;
    function onMove(ev) {
      src.width = Math.max(20, origW + (ev.clientX - startX) / scaleX);
      src.height = Math.max(20, origH + (ev.clientY - startY) / scaleY);
      render();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.dispatchEvent(new CustomEvent('ws:sourcechange', { detail: src }));
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ---- Composite loop (drives the actual outgoing stream) ----
  function getMedia(src) {
    if (mediaCache.has(src.id)) return mediaCache.get(src.id);
    let node = null;
    if (src.type === 'Image' && src.props.url) { node = new Image(); node.src = src.props.url; }
    if (src.type === 'Media' && src.props.url) { node = document.createElement('video'); node.src = src.props.url; node.loop = !!src.props.loop; node.muted = true; node.play().catch(() => {}); }
    if (node) mediaCache.set(src.id, node);
    return node;
  }

  function drawFrame() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (currentScene) {
      currentScene.sources.forEach(src => {
        if (src.visible === false) return;
        if (src.type === 'Image' || src.type === 'Media') {
          const node = getMedia(src);
          if (node && (node.complete || node.readyState >= 2)) {
            try { ctx.drawImage(node, src.x, src.y, src.width, src.height); } catch (e) {}
          }
        } else if (src.type === 'Text') {
          ctx.fillStyle = src.props.color || '#ffffff';
          ctx.font = `${src.props.fontSize || 32}px ${src.props.fontFamily || 'sans-serif'}`;
          ctx.textBaseline = 'middle';
          ctx.fillText(src.props.text || '', src.x, src.y + src.height / 2);
        } else if (src.type === 'Browser Source') {
          // Cross-origin iframe pixels cannot be read into a canvas for security
          // reasons, so browser sources render live in the editor but appear as
          // a labeled placeholder in the outgoing composite.
          ctx.fillStyle = '#111';
          ctx.fillRect(src.x, src.y, src.width, src.height);
          ctx.strokeStyle = '#444'; ctx.strokeRect(src.x, src.y, src.width, src.height);
          ctx.fillStyle = '#888'; ctx.font = '16px sans-serif';
          ctx.fillText(src.name + ' (browser source)', src.x + 8, src.y + 20);
        }
      });
    }
    rafId = requestAnimationFrame(drawFrame);
  }

  function startCompositing() { if (!rafId) drawFrame(); }
  function stopCompositing() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  return {
    setBaseResolution, loadScene, getScene, getSelected, render,
    startCompositing, stopCompositing,
    get canvas() { return canvas; },
    setSelected(id) { selectedSourceId = id; render(); }
  };
})();
