import { Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  SettingsSection,
  StudioSettings,
} from '../types/studio'

interface SettingsPanelProps {
  section: SettingsSection
  settings: StudioSettings
  onSave: (settings: StudioSettings) => void
}

const resolutionOptions = [
  '1920x1080',
  '1280x720',
  '852x480',
  '640x360',
  'Custom',
]

const fpsOptions = [
  '10',
  '20',
  '24 NTSC',
  '25',
  '29.97',
  '30',
  '48',
  '59.94',
  '60',
]

const STREAM_SERVERS = {
  YouTube: 'rtmp://a.rtmp.youtube.com/live2',
  Facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
  Twitch: 'rtmp://live.twitch.tv/app',
  Kick: 'rtmps://fa723fc1.kick.com/app/',
} as const

function isBuiltInService(
  service: StudioSettings['stream']['service'],
): service is keyof typeof STREAM_SERVERS {
  return service in STREAM_SERVERS
}

export function SettingsPanel({
  section,
  settings,
  onSave,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<StudioSettings>(settings)
  const [notification, setNotification] = useState<string | null>(null)
  useEffect(() => {
    setDraft(settings)
  }, [settings, section])

  function save() {
    onSave({
      ...settings,
      ...draft,
      authorization: {
        ...settings.authorization,
        ...draft.authorization,
      },
      stream: {
        ...settings.stream,
        ...draft.stream,
      },
      output: {
        ...settings.output,
        ...draft.output,
      },
      audio: {
        ...settings.audio,
        ...draft.audio,
      },
      video: {
        ...settings.video,
        ...draft.video,
      },
      advanced: {
        ...settings.advanced,
        ...draft.advanced,
      },
    })
    
    setNotification('Settings saved successfully')

  setTimeout(() => {
    setNotification(null)
  }, 2500)
}

  function cancel() {
  setDraft(settings)

  setNotification('Changes cancelled')

  setTimeout(() => {
    setNotification(null)
  }, 2500)
}

  function update<K extends keyof StudioSettings>(
    key: K,
    value: StudioSettings[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <main className="settings-page">
      {notification && (
  <div className="settings-notification">
    {notification}
  </div>
)}
      <div className="settings-heading">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>{section}</h1>
          <p>Configure your Multi Stream Studio workspace.</p>
        </div>
      </div>

      <div className="settings-card">
        {section === 'Authorization' && (
          <div className="settings-form">
            <Field label="Username">
              <input
                value={draft.authorization.username}
                onChange={(event) =>
                  update('authorization', {
                    ...draft.authorization,
                    username: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={draft.authorization.password}
                onChange={(event) =>
                  update('authorization', {
                    ...draft.authorization,
                    password: event.target.value,
                  })
                }
              />
            </Field>
          </div>
        )}

{section === 'Stream' && (
  <div className="settings-form">
    <Field label="Service">
      <select
        value={draft.stream.service}
        onChange={(event) => {
          const service =
            event.target.value as StudioSettings['stream']['service']

          update('stream', {
            ...draft.stream,
            service,
            server: isBuiltInService(service)
              ? STREAM_SERVERS[service]
              : '',
            customServiceName:
              service === 'Custom'
                ? draft.stream.customServiceName
                : '',
          })
        }}
      >
        <option value="YouTube">YouTube</option>
        <option value="Facebook">Facebook</option>
        <option value="Twitch">Twitch</option>
        <option value="Kick">Kick</option>
        <option value="Custom">Custom</option>
      </select>
    </Field>

    {draft.stream.service === 'Custom' && (
      <Field label="Service Name">
        <input
          value={draft.stream.customServiceName}
          placeholder="Example: My RTMP Server"
          onChange={(event) =>
            update('stream', {
              ...draft.stream,
              customServiceName: event.target.value,
            })
          }
        />
      </Field>
    )}

    <Field label="Server">
      <input
        value={draft.stream.server}
        placeholder="rtmp://..."
        readOnly={draft.stream.service !== 'Custom'}
        className={
          draft.stream.service !== 'Custom'
            ? 'input-readonly'
            : ''
        }
        onChange={(event) =>
          update('stream', {
            ...draft.stream,
            server: event.target.value,
          })
        }
      />

      {draft.stream.service !== 'Custom' && (
        <small className="field-hint">
          Server is automatically configured for {draft.stream.service}.
        </small>
      )}
    </Field>

    <Field label="Stream Key">
      <input
        type="password"
        value={draft.stream.streamKey}
        placeholder="Enter stream key"
        onChange={(event) =>
          update('stream', {
            ...draft.stream,
            streamKey: event.target.value,
          })
        }
      />
    </Field>
  </div>
)}

        {section === 'Output' && (
          <div className="settings-grid">
            <Field label="Encoder">
              <select
                value={draft.output.encoder}
                onChange={(event) =>
                  update('output', {
                    ...draft.output,
                    encoder: event.target.value,
                  })
                }
              >
                <option>H.264</option>
                <option>H.265</option>
                <option>AV1</option>
              </select>
            </Field>

            <Field label="Rate Control">
              <select
                value={draft.output.rateControl}
                onChange={(event) =>
                  update('output', {
                    ...draft.output,
                    rateControl: event.target.value,
                  })
                }
              >
                <option>CBR</option>
                <option>VBR</option>
                <option>CRF</option>
              </select>
            </Field>

            <Field label="Bitrate">
              <input
                value={draft.output.bitrate}
                onChange={(event) =>
                  update('output', {
                    ...draft.output,
                    bitrate: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Keyframe Interval">
              <input
                value={draft.output.keyframeInterval}
                onChange={(event) =>
                  update('output', {
                    ...draft.output,
                    keyframeInterval: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Preset">
              <select
                value={draft.output.preset}
                onChange={(event) =>
                  update('output', {
                    ...draft.output,
                    preset: event.target.value,
                  })
                }
              >
                <option>Quality</option>
                <option>Performance</option>
                <option>Balanced</option>
              </select>
            </Field>

            <Field label="Profile">
              <select
                value={draft.output.profile}
                onChange={(event) =>
                  update('output', {
                    ...draft.output,
                    profile: event.target.value,
                  })
                }
              >
                <option>High</option>
                <option>Main</option>
                <option>Baseline</option>
              </select>
            </Field>

            <Field label="Tune">
              <select
                value={draft.output.tune}
                onChange={(event) =>
                  update('output', {
                    ...draft.output,
                    tune: event.target.value,
                  })
                }
              >
                <option>None</option>
                <option>Film</option>
                <option>Animation</option>
                <option>Grain</option>
              </select>
            </Field>
          </div>
        )}

        {section === 'Audio' && (
          <div className="settings-grid">
            <Field label="Encoder">
              <select
                value={draft.audio.encoder}
                onChange={(event) =>
                  update('audio', {
                    ...draft.audio,
                    encoder: event.target.value,
                  })
                }
              >
                <option>AAC</option>
                <option>Opus</option>
              </select>
            </Field>

            <Field label="Bitrate">
              <input
                value={draft.audio.bitrate}
                onChange={(event) =>
                  update('audio', {
                    ...draft.audio,
                    bitrate: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Sample Rate">
              <select
                value={draft.audio.sampleRate}
                onChange={(event) =>
                  update('audio', {
                    ...draft.audio,
                    sampleRate: event.target.value,
                  })
                }
              >
                <option>44.1 kHz</option>
                <option>48 kHz</option>
              </select>
            </Field>

            <Field label="Channels">
              <select
                value={draft.audio.channels}
                onChange={(event) =>
                  update('audio', {
                    ...draft.audio,
                    channels: event.target.value,
                  })
                }
              >
                <option>Mono</option>
                <option>Stereo</option>
              </select>
            </Field>
          </div>
        )}

        {section === 'Video' && (
          <div className="settings-grid">
            <Field label="Base Resolution (Canvas)">
              <select
                value={draft.video.baseResolution}
                onChange={(event) =>
                  update('video', {
                    ...draft.video,
                    baseResolution: event.target.value,
                  })
                }
              >
                {resolutionOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>

            <Field label="Output Resolution (Scaled)">
              <select
                value={draft.video.outputResolution}
                onChange={(event) =>
                  update('video', {
                    ...draft.video,
                    outputResolution: event.target.value,
                  })
                }
              >
                {resolutionOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>

            <Field label="FPS Values">
              <select
                value={draft.video.fps}
                onChange={(event) =>
                  update('video', {
                    ...draft.video,
                    fps: event.target.value,
                  })
                }
              >
                {fpsOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {section === 'Advanced' && (
          <div className="settings-form">
            <label className="checkbox-setting">
              <input
                type="checkbox"
                checked={draft.advanced.automaticallyReconnect}
                onChange={(event) =>
                  update('advanced', {
                    ...draft.advanced,
                    automaticallyReconnect: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Automatically Reconnect</strong>
                <small>Reconnect after a temporary network interruption.</small>
              </span>
            </label>

            <Field label="Network">
              <select
                value={draft.advanced.network}
                onChange={(event) =>
                  update('advanced', {
                    ...draft.advanced,
                    network: event.target.value,
                  })
                }
              >
                <option>Auto</option>
                <option>IPv4</option>
                <option>IPv6</option>
              </select>
            </Field>
          </div>
        )}

        <div className="settings-actions">
          <button className="secondary-button" onClick={cancel}>
            <X size={15} />
            Cancel
          </button>

          <button className="primary-button" onClick={save}>
            <Save size={15} />
            Save
          </button>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
