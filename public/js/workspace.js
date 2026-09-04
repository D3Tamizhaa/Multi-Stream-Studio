const Workspace = (() => {
  let el = null;
  let canvasW = 1920, canvasH = 1080;
  let scale = 1;
  let selectedId = null;
  let onChange = null;   // (sourceId, {x,y,width,height}) -> persist
  let onSelect = null;   // (sourceId) -> notify app

  function init(element) {
    el = element;
    window.addEventListener('resize', () => recomputeScale());
  }

  function setCanvasSize(w, h) {
    canvasW = w; canvasH = h;
    recomputeScale();
  }

  function recomputeScale() {
    if (!el) return;
    scale = el.clientWidth / canvasW;
  }

  function setHandlers({ change, select }) {
    onChange = change;
    onSelect = select;
  }

  function render(sources) {
    if (!el) return;
    recomputeScale();
    el.innerHTML = '';
    for (const src of sources) {
      el.appendChild(buildEl(src));
    }
  }

  function buildEl(src) {
    const div = document.createElement('div');
    div.className = 'ws-source' + (src.id === selectedId ? ' selected' : '') + (src.locked ? ' locked' : '') + (src.visible === false ? ' hidden-source' : '');
    div.dataset.id = src.id;
    positionEl(div, src);

    const label = document.createElement('div');
    label.className = 'ws-label';
    label.textContent = src.name;
    div.appendChild(label);

    if (src.type === 'image' && src.file) {
      const img = document.createElement('img');
      img.src = `/uploads/${src.file}`;
      div.appendChild(img);
    } else if (src.type === 'media' && src.file) {
      if (/\.(mp4|webm)$/i.test(src.file)) {
        const vid = document.createElement('video');
        vid.src = `/uploads/${src.file}`;
        // Local monitoring only -- mirrors the Audio Mixer's per-source
        // Mute/Unmute, which per spec never affects the outgoing stream.
        vid.muted = !!src.muted;
        vid.volume = Math.min(1, typeof src.volume === 'number' ? src.volume : 1);
        vid.loop = true;
        vid.autoplay = true;
        vid.playsInline = true;
        div.appendChild(vid);
      } else {
        const badge = document.createElement('div');
        badge.className = 'ws-text-preview';
        badge.textContent = '♪ audio clip';
        div.appendChild(badge);
      }
    } else if (src.type === 'text') {
      const t = document.createElement('div');
      t.className = 'ws-text-preview';
      t.style.color = colorToCss(src.color);
      t.style.fontFamily = src.fontFamily || 'inherit';
      t.style.fontSize = Math.max(8, Math.round((src.fontSize || 32) * scale)) + 'px';
      t.textContent = src.text || '';
      div.appendChild(t);
    }

    if (!src.locked) {
      const handle = document.createElement('div');
      handle.className = 'ws-resize-handle';
      div.appendChild(handle);
      handle.addEventListener('mousedown', (e) => startResize(e, src, div));
    }

    div.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('ws-resize-handle')) return;
      selectedId = src.id;
      if (onSelect) onSelect(src.id);
      if (!src.locked) startDrag(e, src, div);
      else highlightOnly(div);
    });

    return div;
  }

  function highlightOnly(div) {
    el.querySelectorAll('.ws-source').forEach(n => n.classList.remove('selected'));
    div.classList.add('selected');
  }

  function colorToCss(c) {
    if (!c) return '#fff';
    if (c.startsWith('0x')) return '#' + c.slice(2);
    return c;
  }

  function positionEl(div, src) {
    div.style.left = Math.round(src.x * scale) + 'px';
    div.style.top = Math.round(src.y * scale) + 'px';
    div.style.width = Math.round(src.width * scale) + 'px';
    div.style.height = Math.round(src.height * scale) + 'px';
  }

  function startDrag(e, src, div) {
    e.preventDefault();
    highlightOnly(div);
    const startX = e.clientX, startY = e.clientY;
    const origX = src.x, origY = src.y;

    function onMove(ev) {
      const dxCanvas = (ev.clientX - startX) / scale;
      const dyCanvas = (ev.clientY - startY) / scale;
      src.x = Math.max(0, Math.round(origX + dxCanvas));
      src.y = Math.max(0, Math.round(origY + dyCanvas));
      positionEl(div, src);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (onChange) onChange(src.id, { x: src.x, y: src.y, width: src.width, height: src.height });
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startResize(e, src, div) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const origW = src.width, origH = src.height;

    function onMove(ev) {
      const dwCanvas = (ev.clientX - startX) / scale;
      const dhCanvas = (ev.clientY - startY) / scale;
      src.width = Math.max(20, Math.round(origW + dwCanvas));
      src.height = Math.max(20, Math.round(origH + dhCanvas));
      positionEl(div, src);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (onChange) onChange(src.id, { x: src.x, y: src.y, width: src.width, height: src.height });
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function select(id) {
    selectedId = id;
    if (el) el.querySelectorAll('.ws-source').forEach(n => n.classList.toggle('selected', n.dataset.id === id));
  }

  return { init, setCanvasSize, setHandlers, render, select };
})();
