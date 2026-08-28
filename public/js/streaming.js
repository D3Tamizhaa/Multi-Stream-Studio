const Streaming = (() => {
  let recorder = null;
  let ingestWs = null;
  let statsWs = null;
  let audioCtx = null;
  let destNode = null;
  const gainNodes = new Map(); // sourceId -> {gain, muted}

  function wsUrl(path) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${path}`;
  }

  function ensureAudioGraph() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    destNode = audioCtx.createMediaStreamDestination();
  }

  // Route a <video> element's audio through a per-source gain node so the
  // Audio Mixer's volume/mute controls affect the outgoing stream.
  function connectMediaAudio(sourceId, videoEl) {
    ensureAudioGraph();
    if (gainNodes.has(sourceId)) return;
    try {
      const srcNode = audioCtx.createMediaElementSource(videoEl);
      const gain = audioCtx.createGain();
      srcNode.connect(gain).connect(destNode);
      gainNodes.set(sourceId, gain);
    } catch (e) { /* already connected elsewhere */ }
  }

  function setVolume(sourceId, value) {
    const g = gainNodes.get(sourceId);
    if (g) g.gain.value = value;
  }

  function setMuted(sourceId, muted) {
    const g = gainNodes.get(sourceId);
    if (g) g.gain.value = muted ? 0 : (g._lastValue ?? 1);
  }

  async function start(fps) {
    ensureAudioGraph();
    Workspace.startCompositing();
    const videoStream = Workspace.canvas.captureStream(fps || 30);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...destNode.stream.getAudioTracks()
    ]);

    ingestWs = new WebSocket(wsUrl('/ws/ingest'));
    ingestWs.binaryType = 'arraybuffer';
    await new Promise((resolve, reject) => {
      ingestWs.onopen = resolve;
      ingestWs.onerror = reject;
    });

    recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 4_000_000 });
    recorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0 && ingestWs.readyState === WebSocket.OPEN) {
        ingestWs.send(await e.data.arrayBuffer());
      }
    };
    recorder.start(250); // emit a chunk every 250ms
  }

  function stop() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder = null;
    if (ingestWs) { ingestWs.close(); ingestWs = null; }
    Workspace.stopCompositing();
  }

  function subscribeStats(onStats) {
    statsWs = new WebSocket(wsUrl('/ws/stats'));
    statsWs.onmessage = (e) => { try { onStats(JSON.parse(e.data)); } catch (err) {} };
    statsWs.onclose = () => { setTimeout(() => subscribeStats(onStats), 2000); };
  }

  return { start, stop, connectMediaAudio, setVolume, setMuted, subscribeStats };
})();
