import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, expect, test } from 'vitest'
import { App } from '../../src/app'
import { toLocal } from '../../src/calendar/tz'
import { formatDate } from '../../src/format'
import type { Feature } from '../../src/calendar/types'
import { Day, parseLocalDate } from '../../src/views/Day'

const TZ = 'America/New_York'

function seed(overrides?: { features?: Partial<Record<Feature, boolean>> }) {
  window.localStorage.setItem(
    'picatrix.settings',
    JSON.stringify({
      timeZone: TZ,
      clock: '12h',
      textScale: 1,
      features: {
        phase: true,
        sign: true,
        void: true,
        mansion: true,
        mercury: true,
        ...overrides?.features,
      },
      theme: 'system',
    }),
  )
}

function todayYMD(): string {
  const t = toLocal(new Date(), TZ)
  return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
}

function openDay(date: string) {
  location.hash = `#/day/${date}`
  render(<App />)
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  location.hash = ''
})

test('renders the pinned sections for the 2026-11-20 route', () => {
  seed()
  openDay('2026-11-20')
  expect(screen.getByText('Waxing all day')).toBeTruthy()
  expect(screen.getByText('Pisces until 12:52 AM')).toBeTruthy()
  expect(screen.getByText('Aries after 12:52 AM')).toBeTruthy()
  expect(screen.getByText('Until 12:52 AM')).toBeTruthy()
  expect(screen.getByText('Batn al-Hut until 12:52 AM')).toBeTruthy()
  expect(screen.getByText('Al-Sharatain, 12:52 AM – 11:46 PM')).toBeTruthy()
  expect(screen.getByText('Al-Butain after 11:46 PM')).toBeTruthy()
  expect(screen.getByText('Post-shadow')).toBeTruthy()
  expect(screen.getByText('until Mon, Nov 30, 1:16 AM')).toBeTruthy()
})

test('renders the November 22 void window when rendered directly', () => {
  seed()
  render(<Day date="2026-11-22" />)
  expect(screen.getByText('2:38 AM – 5:09 AM')).toBeTruthy()
})

test('next and previous day buttons change the route', async () => {
  seed()
  openDay('2026-11-20')
  fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
  await waitFor(() => expect(location.hash).toBe('#/day/2026-11-21'))
  expect(await screen.findByText('Aries all day')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
  await waitFor(() => expect(location.hash).toBe('#/day/2026-11-20'))
  expect(await screen.findByText('Pisces until 12:52 AM')).toBeTruthy()
})

test('the date input changes the route', async () => {
  seed()
  openDay('2026-11-20')
  fireEvent.change(screen.getByLabelText('Go to date'), { target: { value: '2026-11-22' } })
  await waitFor(() => expect(location.hash).toBe('#/day/2026-11-22'))
  expect(await screen.findByText('2:38 AM – 5:09 AM')).toBeTruthy()
})

test('rows open the sheet with the derived content', () => {
  seed()
  openDay('2026-11-20')
  fireEvent.click(screen.getByText('Pisces until 12:52 AM'))
  expect(screen.getByRole('dialog', { name: 'Pisces' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByText('Batn al-Hut until 12:52 AM'))
  expect(screen.getByRole('dialog', { name: 'Batn al-Hut' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByText('Until 12:52 AM'))
  expect(screen.getByRole('dialog', { name: 'Void Ending in a Trine to the Sun' })).toBeTruthy()
})

test('sign and mansion row glyphs stay silent while the void aspect glyph keeps its label', () => {
  seed()
  openDay('2026-11-20')
  expect(screen.queryByLabelText('Pisces')).toBeNull()
  expect(screen.queryByLabelText('Mansion 28 of 28')).toBeNull()
  expect(screen.getByLabelText('Trine')).toBeTruthy()
})

test('the sign section is absent when the feature is off, and the others remain', () => {
  seed({ features: { sign: false } })
  openDay('2026-11-20')
  expect(screen.queryByText('Pisces until 12:52 AM')).toBeNull()
  expect(screen.queryByText('Aries after 12:52 AM')).toBeNull()
  expect(screen.getByText('Waxing all day')).toBeTruthy()
  expect(screen.getByText('Until 12:52 AM')).toBeTruthy()
})

test('a day with a phase event shows the state at day start and the event', () => {
  seed()
  render(<Day date="2026-11-01" />)
  expect(screen.getByText('Waning at day start')).toBeTruthy()
  expect(screen.getByText('Last Quarter at 3:28 PM')).toBeTruthy()
  expect(screen.getByText('Until 12:18 AM')).toBeTruthy()
})

test('a Mercury station day lists its transition', () => {
  seed()
  render(<Day date="2026-11-13" />)
  expect(screen.getByText('Retrograde')).toBeTruthy()
  expect(screen.getByText('until 10:52 AM')).toBeTruthy()
  expect(screen.getByText('turns direct at 10:52 AM')).toBeTruthy()
})

test('a quiet Mercury day points at the next cycle', () => {
  seed()
  render(<Day date="2026-12-05" />)
  expect(screen.getByText('Direct')).toBeTruthy()
  expect(screen.getByText('next cycle from Mon, Jan 25, 2027, 1:58 PM')).toBeTruthy()
})

test('a date after 2100-12-31 shows a message instead of data', () => {
  seed()
  openDay('2101-01-01')
  expect(
    screen.getByText('No data for this date. The ephemeris covers 1900-01-01 through 2100-12-31.'),
  ).toBeTruthy()
  expect(screen.queryByText('Phase')).toBeNull()
  expect(screen.queryByText('Waxing all day')).toBeNull()
})

test('a date before 1900-01-01 shows a message instead of data', () => {
  seed()
  render(<Day date="1899-12-31" />)
  expect(
    screen.getByText('No data for this date. The ephemeris covers 1900-01-01 through 2100-12-31.'),
  ).toBeTruthy()
  expect(screen.queryByText('Phase')).toBeNull()
})

test('an invalid route date redirects to today in the effective time zone', async () => {
  seed()
  openDay('2026-13-45')
  const today = todayYMD()
  await waitFor(() => expect(location.hash).toBe(`#/day/${today}`))
  expect(await screen.findByText(formatDate(parseLocalDate(today)!))).toBeTruthy()
  expect(screen.queryByText(/No data for this date/)).toBeNull()
})
