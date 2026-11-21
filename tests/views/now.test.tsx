import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, expect, test, vi } from 'vitest'
import type { Feature } from '../../src/calendar/types'
import { Now } from '../../src/views/Now'

const AT = () => new Date('2026-11-20T15:28:00Z')

function seed(overrides?: { features?: Partial<Record<Feature, boolean>> }) {
  window.localStorage.setItem(
    'picatrix.settings',
    JSON.stringify({
      timeZone: 'America/New_York',
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

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

test('shows every card at the fixed clock', () => {
  seed()
  render(<Now now={AT} />)
  expect(screen.getByText('Waxing')).toBeTruthy()
  expect(screen.getByText('Aries')).toBeTruthy()
  expect(screen.getByText('until 2026-11-22, 5:09 AM')).toBeTruthy()
  expect(screen.getByText('Later')).toBeTruthy()
  expect(screen.getByText('from 2:38 AM to 5:09 AM')).toBeTruthy()
  expect(screen.getByText('Al-Sharatain')).toBeTruthy()
  expect(screen.getByText('until 2026-11-20, 11:46 PM')).toBeTruthy()
  expect(screen.getByText('leaving')).toBeTruthy()
})

test('the sign card next control moves that card to Taurus and Now resets it', () => {
  seed()
  render(<Now now={AT} />)
  fireEvent.click(screen.getByRole('button', { name: 'Next sign' }))
  expect(screen.getByText('Taurus')).toBeTruthy()
  expect(screen.queryByText('Aries')).toBeNull()
  expect(screen.getByText('at 2026-11-22, 5:09 AM')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Now' }))
  expect(screen.getByText('Aries')).toBeTruthy()
  expect(screen.queryByText('Taurus')).toBeNull()
  expect(screen.queryByText(/^at /)).toBeNull()
})

test('the sign card previous control moves that card to Pisces', () => {
  seed()
  render(<Now now={AT} />)
  fireEvent.click(screen.getByRole('button', { name: 'Previous sign' }))
  expect(screen.getByText('Pisces')).toBeTruthy()
  expect(screen.queryByText('Aries')).toBeNull()
  expect(screen.getByText('at 2026-11-17, 4:19 PM')).toBeTruthy()
})

test('a card body opens the sheet through the overlay button', () => {
  seed()
  render(<Now now={AT} />)
  const open = screen.getByRole('button', { name: 'Open sign details' })
  open.focus()
  expect(document.activeElement).toBe(open)
  fireEvent.click(open)
  expect(screen.getByRole('dialog', { name: 'Aries' })).toBeTruthy()
})

test('the mansion card is absent when the feature is off, and the others remain', () => {
  seed({ features: { mansion: false } })
  render(<Now now={AT} />)
  expect(screen.queryByText('Al-Sharatain')).toBeNull()
  expect(screen.getByText('Waxing')).toBeTruthy()
  expect(screen.getByText('Aries')).toBeTruthy()
  expect(screen.getByText('Later')).toBeTruthy()
  expect(screen.getByText('leaving')).toBeTruthy()
})

test('a device clock outside the supported range renders no-data cards instead of crashing', () => {
  seed()
  render(<Now now={() => new Date('2200-01-01T00:00:00Z')} />)
  expect(screen.queryByText('Aries')).toBeNull()
  expect(screen.getAllByText('No data').length).toBe(5)
})

test('the refresh interval survives unrelated state updates with the default clock', () => {
  seed()
  const spy = vi.spyOn(globalThis, 'setInterval')
  render(<Now />)
  const created = spy.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: 'Next sign' }))
  fireEvent.click(screen.getByRole('button', { name: 'Now' }))
  expect(spy.mock.calls.length).toBe(created)
})

test('becoming visible again refreshes the base time', () => {
  seed()
  let t = new Date('2026-11-20T15:28:00Z')
  render(<Now now={() => t} />)
  expect(screen.getByText('2026-11-20, 10:28 AM')).toBeTruthy()
  t = new Date('2026-11-20T16:34:00Z')
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByText('2026-11-20, 11:34 AM')).toBeTruthy()
})
