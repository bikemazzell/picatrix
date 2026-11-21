import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, expect, test } from 'vitest'
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
  fireEvent.click(screen.getByRole('button', { name: 'Now' }))
  expect(screen.getByText('Aries')).toBeTruthy()
  expect(screen.queryByText('Taurus')).toBeNull()
})

test('a card body click opens the sheet with the sign content', () => {
  seed()
  render(<Now now={AT} />)
  fireEvent.click(screen.getByText('Aries'))
  expect(screen.getByRole('dialog', { name: 'Aries' })).toBeTruthy()
})

test('the mansion card is absent when the feature is off', () => {
  seed({ features: { mansion: false } })
  render(<Now now={AT} />)
  expect(screen.queryByText('Al-Sharatain')).toBeNull()
})

test('a device clock outside the supported range renders no-data cards instead of crashing', () => {
  seed()
  render(<Now now={() => new Date('2200-01-01T00:00:00Z')} />)
  expect(screen.queryByText('Aries')).toBeNull()
  expect(screen.getAllByText('No data').length).toBe(5)
})
