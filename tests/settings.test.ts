import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidTimeZone } from '../src/calendar/tz'
import { effectiveTimeZone, loadSettings, saveSettings, type Settings } from '../src/settings'

function sample(): Settings {
  return {
    timeZone: 'Europe/Berlin',
    clock: '24h',
    textScale: 1.2,
    features: { phase: false, sign: true, void: false, mansion: true, mercury: false },
    theme: 'dark',
  }
}

describe('loadSettings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns defaults when storage is empty', () => {
    const s = loadSettings()
    expect(s.timeZone).toBeNull()
    expect(['12h', '24h']).toContain(s.clock)
    expect(s.textScale).toBe(1)
    expect(s.features).toEqual({ phase: true, sign: true, void: true, mansion: true, mercury: true })
    expect(s.theme).toBe('system')
  })

  it('round trips a full settings object', () => {
    saveSettings(sample())
    expect(loadSettings()).toEqual(sample())
  })

  it('returns defaults when the storage read throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const s = loadSettings()
    expect(s.timeZone).toBeNull()
    expect(s.textScale).toBe(1)
    expect(s.features.phase).toBe(true)
    expect(s.theme).toBe('system')
  })

  it('does not throw when the storage write throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveSettings(sample())).not.toThrow()
  })

  it('falls back to null for an invalid stored time zone', () => {
    saveSettings({ ...sample(), timeZone: 'Not/AZone' })
    const s = loadSettings()
    expect(s.timeZone).toBeNull()
    expect(s.clock).toBe('24h')
    expect(s.theme).toBe('dark')
  })

  it('rejects a hostile stored payload field by field', () => {
    const deviceClock = loadSettings().clock
    window.localStorage.setItem(
      'picatrix.settings',
      '{"timeZone":"Not/AZone","clock":"metric","textScale":"abc","features":{"phase":"yes","sign":false},"theme":"dark"}',
    )
    const s = loadSettings()
    expect(s.timeZone).toBeNull()
    expect(s.clock).toBe(deviceClock)
    expect(s.textScale).toBe(1)
    expect(s.features.phase).toBe(true)
    expect(s.features.sign).toBe(false)
    expect(s.theme).toBe('dark')
  })

  it('returns defaults for malformed stored JSON', () => {
    window.localStorage.setItem('picatrix.settings', '{not json')
    const s = loadSettings()
    expect(s.timeZone).toBeNull()
    expect(s.textScale).toBe(1)
    expect(s.theme).toBe('system')
  })
})

describe('effectiveTimeZone', () => {
  it('prefers the stored time zone', () => {
    expect(effectiveTimeZone(sample())).toBe('Europe/Berlin')
  })

  it('resolves the device time zone when none is stored', () => {
    const tz = effectiveTimeZone({ ...sample(), timeZone: null })
    expect(tz).not.toBe('')
    expect(isValidTimeZone(tz)).toBe(true)
  })
})
