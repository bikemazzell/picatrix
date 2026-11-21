import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  applyPresentation,
  effectiveTimeZone,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  useSettings,
  type Settings,
} from '../settings'
import { FEATURES, HEADINGS } from './features'

const ZONE_ALIASES: Record<string, string> = {
  'America/Godthab': 'America/Nuuk',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Pacific/Enderbury': 'Pacific/Kanton',
}

const ZONE_PREVIEW_COUNT = 60

function canonicalZone(zone: string): string {
  return ZONE_ALIASES[zone] ?? zone
}

function supportedZones(): string[] | null {
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf
  if (typeof supported !== 'function') return null
  try {
    const zones = [...new Set(supported.call(Intl, 'timeZone').map(canonicalZone))].sort()
    return zones.length > 0 ? zones : null
  } catch {
    return null
  }
}

const ALL_ZONES = supportedZones()

export function SettingsView() {
  const [settings, update, saved] = useSettings()
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    applyPresentation(settings)
  }, [settings])

  const zoneState = useMemo(() => {
    if (ALL_ZONES === null) return null
    const q = query.trim().toLowerCase()
    const shown =
      q === ''
        ? ALL_ZONES.slice(0, ZONE_PREVIEW_COUNT)
        : ALL_ZONES.filter(zone => zone.toLowerCase().includes(q))
    return { shown, total: ALL_ZONES.length, searching: q !== '' }
  }, [query])

  const setTimeZone = (timeZone: string | null) =>
    update({ ...settings, timeZone: timeZone === null ? null : canonicalZone(timeZone) })

  const pickTimeZone = (timeZone: string | null) => {
    setTimeZone(timeZone)
    setPicking(false)
    setQuery('')
  }

  const currentZone =
    settings.timeZone === null
      ? `Device time zone (${effectiveTimeZone(settings)})`
      : canonicalZone(settings.timeZone)

  return (
    <div class="settings-view">
      <h1>Settings</h1>
      {!saved && (
        <p class="save-warning" role="alert">
          This browser did not save your settings. They apply now but reset when you reload.
        </p>
      )}
      <section class="panel">
        <h2>Time zone</h2>
        {zoneState === null ? (
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
        ) : picking ? (
          <>
            <label class="field field-stack">
              Search time zones
              <input
                type="search"
                value={query}
                autoFocus
                onInput={e => setQuery((e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            {!zoneState.searching && (
              <p class="zone-hint">Type to search all {zoneState.total} zones</p>
            )}
            <button
              type="button"
              class="zone-pick"
              aria-pressed={settings.timeZone === null}
              onClick={() => pickTimeZone(null)}
            >
              Use device time zone
            </button>
            <ul class="zone-list">
              {zoneState.shown.map(zone => (
                <li key={zone}>
                  <button
                    type="button"
                    class="zone-pick"
                    aria-pressed={
                      settings.timeZone !== null && canonicalZone(settings.timeZone) === zone
                    }
                    onClick={() => pickTimeZone(zone)}
                  >
                    {zone}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" class="zone-toggle" onClick={() => setPicking(false)}>
              Cancel
            </button>
          </>
        ) : (
          <div class="field">
            <span class="zone-current">{currentZone}</span>
            <button type="button" class="zone-toggle" onClick={() => setPicking(true)}>
              Change
            </button>
          </div>
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
            <option value="auto">Device default</option>
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
              min={TEXT_SCALE_MIN}
              max={TEXT_SCALE_MAX}
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
