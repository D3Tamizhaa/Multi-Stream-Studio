const express = require('express');
const router = express.Router();
const store = require('../store');
const streamManager = require('../ffmpeg/streamManager');
const { capabilitiesPayload } = require('../ffmpeg/encoderCapabilities');

// Well-known ingest servers; YouTube/Facebook/Twitch/Kick auto-fill and are not manually editable.
const SERVICE_SERVERS = {
  YouTube: 'rtmp://a.rtmp.youtube.com/live2',
  Facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
  Twitch: 'rtmp://live.twitch.tv/app',
  Kick: 'rtmps://fa723fc1b171.global-contribute.live-video.net/live',
};

router.get('/', (req, res) => res.json(store.getSettings()));

router.get('/capabilities', (req, res) => res.json(capabilitiesPayload()));

router.put('/output', (req, res) => {
  const data = store.getSettings();
  data.output = req.body || data.output;
  store.saveSettings(data);
  streamManager.restartIfLive();
  res.json(data.output);
});

router.put('/audio', (req, res) => {
  const data = store.getSettings();
  data.audio = req.body || data.audio;
  store.saveSettings(data);
  streamManager.restartIfLive();
  res.json(data.audio);
});

router.put('/video', (req, res) => {
  const data = store.getSettings();
  data.video = req.body || data.video;
  store.saveSettings(data);
  streamManager.restartIfLive();
  res.json(data.video);
});

router.put('/advanced', (req, res) => {
  const data = store.getSettings();
  data.advanced = req.body || data.advanced;
  store.saveSettings(data);
  res.json(data.advanced);
});

// ---- Stream services (YouTube/Facebook/Twitch/Kick/RTMP) ----
router.get('/stream/servers', (req, res) => res.json(SERVICE_SERVERS));

router.post('/stream/services', (req, res) => {
  const { service, streamKey, server, name } = req.body || {};
  if (!service) return res.status(400).json({ error: 'Service is required' });
  if (service !== 'RTMP' && !streamKey) return res.status(400).json({ error: 'Stream key is required' });
  if (service === 'RTMP' && (!server || !name)) {
    return res.status(400).json({ error: 'Custom RTMP requires a server URL and a service name' });
  }

  const data = store.getSettings();
  const entry = {
    id: `svc-${store.id()}`,
    service,
    server: service === 'RTMP' ? server : SERVICE_SERVERS[service],
    streamKey: streamKey || '',
    name: service === 'RTMP' ? name : service,
  };
  data.stream.services.push(entry);
  store.saveSettings(data);

  // Auto-create a matching entry in the Platforms panel, disabled by default.
  const platforms = store.getPlatforms();
  platforms.platforms.push({
    id: `plat-${store.id()}`,
    serviceId: entry.id,
    label: entry.name,
    rtmpUrl: `${entry.server}/${entry.streamKey}`,
    enabled: false,
  });
  store.savePlatforms(platforms);

  res.status(201).json(entry);
});

router.put('/stream/services/:id', (req, res) => {
  const data = store.getSettings();
  const svc = data.stream.services.find((s) => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  const { streamKey, server, name } = req.body || {};
  if (streamKey !== undefined) svc.streamKey = streamKey;
  if (svc.service === 'RTMP') {
    if (server !== undefined) svc.server = server;
    if (name !== undefined) svc.name = name;
  }
  store.saveSettings(data);

  const platforms = store.getPlatforms();
  const plat = platforms.platforms.find((p) => p.serviceId === svc.id);
  if (plat) {
    plat.label = svc.name;
    plat.rtmpUrl = `${svc.server}/${svc.streamKey}`;
    store.savePlatforms(platforms);
  }
  res.json(svc);
});

router.delete('/stream/services/:id', (req, res) => {
  const data = store.getSettings();
  data.stream.services = data.stream.services.filter((s) => s.id !== req.params.id);
  store.saveSettings(data);
  const platforms = store.getPlatforms();
  platforms.platforms = platforms.platforms.filter((p) => p.serviceId !== req.params.id);
  store.savePlatforms(platforms);
  res.json({ ok: true });
});

// ---- Platforms panel ----
router.get('/platforms', (req, res) => res.json(store.getPlatforms()));

router.put('/platforms/:id', (req, res) => {
  const data = store.getPlatforms();
  const plat = data.platforms.find((p) => p.id === req.params.id);
  if (!plat) return res.status(404).json({ error: 'Platform not found' });
  Object.assign(plat, req.body || {});
  store.savePlatforms(data);
  res.json(plat);
});

router.delete('/platforms/:id', (req, res) => {
  const data = store.getPlatforms();
  data.platforms = data.platforms.filter((p) => p.id !== req.params.id);
  store.savePlatforms(data);
  res.json({ ok: true });
});

module.exports = router;
