import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, expect, test } from 'vitest'
import { version } from '../../package.json'
import { App } from '../../src/app'
import type { Feature } from '../../src/calendar/types'
import { SettingsView } from '../../src/views/SettingsView'

function seed(timeZone: string | null = null) {
  window.localStorage.setItem(
    'picatrix.settings',
    JSON.stringify({
      timeZone,
      clock: '12h',
      textScale: 1,
      features: {
        phase: true,
        sign: true,
        void: true,
        mansion: true,
        mercury: true,
      },
      theme: 'system',
    }),
  )
}

function stored(): {
  timeZone: string | null
  clock: string
  textScale: number
  features: Record<Feature, boolean>
  theme: string
} {
  return JSON.parse(window.localStorage.getItem('picatrix.settings') ?? '{}')
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  location.hash = ''
  document.documentElement.style.removeProperty('--text-scale')
  document.documentElement.removeAttribute('data-theme')
})

test('the time zone picker lists zones, filters by search, and offers the device choice', () => {
  seed()
  render(<SettingsView />)
  expect(screen.getByRole('button', { name: 'Asia/Kolkata' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'America/New_York' })).toBeTruthy()
  fireEvent.input(screen.getByLabelText('Search time zones'), { target: { value: 'Kolkata' } })
  expect(screen.getByRole('button', { name: 'Asia/Kolkata' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'America/New_York' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Use device time zone' })).toBeTruthy()
})

test('choosing Asia/Kolkata saves it and the Day view then uses it', () => {
  seed()
  render(<SettingsView />)
  fireEvent.click(screen.getByRole('button', { name: 'Asia/Kolkata' }))
  expect(stored().timeZone).toBe('Asia/Kolkata')
  cleanup()
  location.hash = '#/day/2026-11-20'
  render(<App />)
  expect(screen.getByText('Pisces until 11:22 AM')).toBeTruthy()
  expect(screen.getByText('Aries after 11:22 AM')).toBeTruthy()
})

test('Use device time zone nulls the stored zone', () => {
  seed('Asia/Kolkata')
  render(<SettingsView />)
  fireEvent.click(screen.getByRole('button', { name: 'Use device time zone' }))
  expect(stored().timeZone).toBeNull()
})

test('the clock choice saves', () => {
  seed()
  render(<SettingsView />)
  fireEvent.change(screen.getByLabelText('Clock'), { target: { value: '24h' } })
  expect(stored().clock).toBe('24h')
})

test('the text size control saves and sets the root variable', () => {
  seed()
  render(<SettingsView />)
  expect(screen.getByText('1')).toBeTruthy()
  fireEvent.input(screen.getByLabelText('Text size'), { target: { value: '1.25' } })
  expect(stored().textScale).toBe(1.25)
  expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.25')
  expect(screen.getByText('1.25')).toBeTruthy()
})

test('feature switches save', () => {
  seed()
  render(<SettingsView />)
  fireEvent.click(screen.getByLabelText('Void'))
  const features = stored().features
  expect(features.void).toBe(false)
  expect(features.phase).toBe(true)
  expect(features.sign).toBe(true)
  expect(features.mansion).toBe(true)
  expect(features.mercury).toBe(true)
})

test('the theme choice saves and sets data-theme', () => {
  seed()
  render(<SettingsView />)
  fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } })
  expect(stored().theme).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'system' } })
  expect(stored().theme).toBe('system')
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
})

test('the settings route renders the view', () => {
  seed()
  location.hash = '#/settings'
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
})

test('About shows the version, license, range, privacy note, color key, and credits', () => {
  location.hash = '#/about'
  render(<App />)
  expect(screen.getByText(`Version ${version}`)).toBeTruthy()
  expect(screen.getByText('Released under the MIT License.')).toBeTruthy()
  expect(screen.getByText('The ephemeris covers 1900-01-01 through 2100-12-31.')).toBeTruthy()
  expect(
    screen.getByText('Only the time zone setting matters: the almanac never uses your location.'),
  ).toBeTruthy()
  for (const label of ['Fire', 'Earth', 'Air', 'Water', 'Void']) {
    expect(screen.getByText(label)).toBeTruthy()
  }
  expect(screen.getByText('Inspired by iLuna by Alexander Kolesnikov.')).toBeTruthy()
  expect(
    screen.getByText(
      'Texts are paraphrases adapted from Picatrix (Ghāyat al-Ḥakīm), translated by Dan Attrell and David Porreca (Penn State Press, 2019).',
    ),
  ).toBeTruthy()
})
