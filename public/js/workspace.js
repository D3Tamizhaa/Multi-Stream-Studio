// Workspace: draws the active scene's sources positioned/sized in the
// same coordinate space as the FFmpeg output resolution, scaled down
// to fit the responsive workspace element. Dragging/resizing writes
// back through PATCH /api/sources/:id in output-resolution pixels, so
// what you see in the browser is exactly what gets streamed.
const Workspace = (() => {
  const el = document.getElementById('workspace');
  const toggleBtn = document.getElementById('preview-toggle');
  let outputWidth = 1280;
  let outputHeight = 720;
  let selectedId = null;
  let previewMode = false;
  let onSelect = () => {};

  function scale() {
    return el.clientWidth / outputWidth;
  }

  async function setOutputResolution(w, h) {
    outputWidth = w;
    outputHeight = h;
  }

  function render(sources) {
    el.innerHTML = '';
    const s = scale();
    sources.forEach((src) => {
      const box = document.createElement('div');
      box.className = 'ws-source' + (src.locked ? ' locked' : '') + (src.id === selectedId ? ' selected' : '');
      box.style.left = `${src.x * s}px`;
      box.style.top = `${src.y * s}px`;
      box.style.width = `${src.width * s}px`;
      box.style.height = `${src.height * s}px`;
      box.style.zIndex = String(src.order || 0);
      if (src.visible === false) box.style.opacity = '0.25';

      if (src.type === 'image') {
        const img = document.createElement('img');
        img.src = `/uploads/${src.file}`;
        box.appendChild(img);
      } else if (src.type === 'media') {
        const video = document.createElement('video');
        video.src = `/uploads/${src.file}`;
        video.muted = !!src.muted;
        video.volume = src.volume === undefined ? 1 : Number(src.volume);
        video.loop = !!src.loop;
        video.autoplay = true;
        video.playsInline = true;
        box.appendChild(video);
      } else if (src.type === 'text') {
        const span = document.createElement('div');
        span.className = 'ws-text';
        span.textContent = src.text || '';
        span.style.fontFamily = src.fontFamily || 'inherit';
        span.style.fontSize = `${(src.fontSize || 32) * s}px`;
        span.style.color = src.color || '#fff';
        box.appendChild(span);
      }

      if (!previewMode && !src.locked) {
        const handle = document.createElement('div');
        handle.className = 'ws-handle';
        box.appendChild(handle);
        attachResize(handle, box, src);
      }

      if (!previewMode) {
        box.addEventListener('pointerdown', (e) => {
          if (e.target.classList.contains('ws-handle')) return;
          if (src.locked) return;
          selectedId = src.id;
          onSelect(src.id);
          startDrag(e, box, src);
        });
      }

      el.appendChild(box);
    });
  }

  function startDrag(e, box, src) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = parseFloat(box.style.left);
    const origTop = parseFloat(box.style.top);
    document.querySelectorAll('.ws-source').forEach((b) => b.classList.remove('selected'));
    box.classList.add('selected');

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      box.style.left = `${origLeft + dx}px`;
      box.style.top = `${origTop + dy}px`;
    }
    async function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const s = scale();
      const newX = Math.round(parseFloat(box.style.left) / s);
      const newY = Math.round(parseFloat(box.style.top) / s);
      await API.patch(`/api/sources/${src.id}`, { x: newX, y: newY });
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function attachResize(handle, box, src) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origW = parseFloat(box.style.width);
      const origH = parseFloat(box.style.height);

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        box.style.width = `${Math.max(20, origW + dx)}px`;
        box.style.height = `${Math.max(20, origH + dy)}px`;
      }
      async function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const s = scale();
        const newW = Math.round(parseFloat(box.style.width) / s);
        const newH = Math.round(parseFloat(box.style.height) / s);
        await API.patch(`/api/sources/${src.id}`, { width: newW, height: newH });
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  toggleBtn.addEventListener('click', () => {
    previewMode = !previewMode;
    el.classList.toggle('preview-mode', previewMode);
    toggleBtn.classList.toggle('active', previewMode);
    document.dispatchEvent(new CustomEvent('workspace:rerender'));
  });

  return {
    render,
    setOutputResolution,
    select: (id) => { selectedId = id; },
    get selectedId() { return selectedId; },
    set onSelect(fn) { onSelect = fn; }
  };
})();
