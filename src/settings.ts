import { useCallback, useEffect, useState } from 'preact/hooks'
import { isValidTimeZone } from './calendar/tz'
import type { Feature } from './calendar/types'
import type { Clock } from './format'

export interface Settings {
  timeZone: string | null
  clock: 'auto' | Clock
  textScale: number
  features: Record<Feature, boolean>
  theme: 'system' | 'light' | 'dark'
}

const STORAGE_KEY = 'picatrix.settings'
const FEATURES: readonly Feature[] = ['phase', 'sign', 'void', 'mansion', 'mercury']
export const TEXT_SCALE_MIN = 0.8
export const TEXT_SCALE_MAX = 1.5

function deviceClock(): Clock {
  const { hourCycle, hour12 } = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
  }).resolvedOptions()
  const cycle = hourCycle ?? (hour12 === false ? 'h23' : 'h12')
  return cycle === 'h11' || cycle === 'h12' ? '12h' : '24h'
}

function defaultSettings(): Settings {
  return {
    timeZone: null,
    clock: 'auto',
    textScale: 1,
    features: { phase: true, sign: true, void: true, mansion: true, mercury: true },
    theme: 'system',
  }
}

function coerce(raw: unknown): Settings {
  const defaults = defaultSettings()
  if (typeof raw !== 'object' || raw === null) return defaults
  const stored = raw as Partial<Settings> & { features?: Partial<Record<Feature, boolean>> }
  const features = { ...defaults.features }
  for (const feature of FEATURES) {
    const value = stored.features?.[feature]
    if (typeof value === 'boolean') features[feature] = value
  }
  const textScale =
    typeof stored.textScale === 'number' && Number.isFinite(stored.textScale)
      ? Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, stored.textScale))
      : defaults.textScale
  return {
    timeZone:
      typeof stored.timeZone === 'string' && isValidTimeZone(stored.timeZone)
        ? stored.timeZone
        : null,
    clock:
      stored.clock === 'auto' || stored.clock === '12h' || stored.clock === '24h'
        ? stored.clock
        : defaults.clock,
    textScale,
    features,
    theme:
      stored.theme === 'system' || stored.theme === 'light' || stored.theme === 'dark'
        ? stored.theme
        : defaults.theme,
  }
}

export function loadSettings(): Settings {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return defaultSettings()
  }
  if (raw === null) return defaultSettings()
  try {
    return coerce(JSON.parse(raw))
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(s: Settings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

export function effectiveClock(s: Settings): Clock {
  return s.clock === 'auto' ? deviceClock() : s.clock
}

export function effectiveTimeZone(s: Settings): string {
  if (s.timeZone !== null) return s.timeZone
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function applyPresentation(s: Settings): void {
  const root = document.documentElement
  root.style.setProperty('--text-scale', String(s.textScale))
  if (s.theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', s.theme)
}

interface SettingsState {
  settings: Settings
  saved: boolean
}

const subscribers = new Set<(state: SettingsState) => void>()

function publish(state: SettingsState): void {
  for (const subscriber of subscribers) subscriber(state)
}

export function useSettings(): [Settings, (s: Settings) => void, boolean] {
  const [state, setState] = useState<SettingsState>(() => ({ settings: loadSettings(), saved: true }))
  useEffect(() => {
    subscribers.add(setState)
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setState({ settings: loadSettings(), saved: true })
    }
    window.addEventListener('storage', onStorage)
    return () => {
      subscribers.delete(setState)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  const update = useCallback((next: Settings) => {
    publish({ settings: next, saved: saveSettings(next) })
  }, [])
  return [state.settings, update, state.saved]
}
