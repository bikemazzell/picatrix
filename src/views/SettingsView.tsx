import { useEffect, useMemo, useState } from 'preact/hooks'
import { applyPresentation, useSettings, type Settings } from '../settings'
import { FEATURES, HEADINGS } from './features'

const ZONE_ALIASES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
}

function supportedZones(): string[] | null {
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf
  if (typeof supported !== 'function') return null
  try {
    const zones = [...new Set(supported.call(Intl, 'timeZone').map(z => ZONE_ALIASES[z] ?? z))].sort()
    return zones.length > 0 ? zones : null
  } catch {
    return null
  }
}

const ALL_ZONES = supportedZones()

export function SettingsView() {
  const [settings, update] = useSettings()
  const [query, setQuery] = useState('')

  useEffect(() => {
    applyPresentation(settings)
  }, [settings])

  const zones = useMemo(() => {
    if (ALL_ZONES === null) return null
    const q = query.trim().toLowerCase()
    if (q === '') return ALL_ZONES
    return ALL_ZONES.filter(zone => zone.toLowerCase().includes(q))
  }, [query])

  const setTimeZone = (timeZone: string | null) => update({ ...settings, timeZone })

  return (
    <div class="settings-view">
      <h1>Settings</h1>
      <section class="panel">
        <h2>Time zone</h2>
        {zones === null ? (
          <label class="field">
            Time zone
            <input
              type="text"
              value={settings.timeZone ?? ''}
              onInput={e => {
                const value = (e.currentTarget as HTMLInputElement).value
                setTimeZone(value === '' ? null : value)
              }}
            />
          </label>
        ) : (
          <>
            <label class="field">
              Search time zones
              <input
                type="search"
                value={query}
                onInput={e => setQuery((e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <button
              type="button"
              class="zone-pick"
              aria-pressed={settings.timeZone === null}
              onClick={() => setTimeZone(null)}
            >
              Use device time zone
            </button>
            <ul class="zone-list">
              {zones.map(zone => (
                <li key={zone}>
                  <button
                    type="button"
                    class="zone-pick"
                    aria-pressed={zone === settings.timeZone}
                    onClick={() => setTimeZone(zone)}
                  >
                    {zone}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section class="panel">
        <h2>Clock</h2>
        <label class="field">
          Clock
          <select
            value={settings.clock}
            onChange={e =>
              update({
                ...settings,
                clock: (e.currentTarget as HTMLSelectElement).value as Settings['clock'],
              })
            }
          >
            <option value="12h">12-hour</option>
            <option value="24h">24-hour</option>
          </select>
        </label>
      </section>
      <section class="panel">
        <h2>Text size</h2>
        <div class="text-size-row">
          <label>
            Text size
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              value={settings.textScale}
              onInput={e =>
                update({
                  ...settings,
                  textScale: Number((e.currentTarget as HTMLInputElement).value),
                })
              }
            />
          </label>
          <span class="field-value">{settings.textScale}</span>
        </div>
      </section>
      <section class="panel">
        <h2>Features</h2>
        <ul class="feature-list">
          {FEATURES.map(feature => (
            <li key={feature}>
              <label>
                <input
                  type="checkbox"
                  checked={settings.features[feature]}
                  onChange={e =>
                    update({
                      ...settings,
                      features: {
                        ...settings.features,
                        [feature]: (e.currentTarget as HTMLInputElement).checked,
                      },
                    })
                  }
                />
                {HEADINGS[feature]}
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel">
        <h2>Theme</h2>
        <label class="field">
          Theme
          <select
            value={settings.theme}
            onChange={e =>
              update({
                ...settings,
                theme: (e.currentTarget as HTMLSelectElement).value as Settings['theme'],
              })
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>
    </div>
  )
}
