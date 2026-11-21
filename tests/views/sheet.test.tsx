import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, expect, test, vi } from 'vitest'
import { Sheet } from '../../src/views/Sheet'

afterEach(cleanup)

test('sheet shows mansion title, source, and the four section headings', () => {
  render(<Sheet contentId="mansion/28" onClose={() => {}} />)
  expect(screen.getByText('Batn al-Hut')).toBeTruthy()
  expect(screen.getByText(/^Picatrix \(adapted\)/)).toBeTruthy()
  expect(screen.getByText('Essence')).toBeTruthy()
  expect(screen.getByText('Good For')).toBeTruthy()
  expect(screen.getByText('Not Good For')).toBeTruthy()
  expect(screen.getByText('Talisman')).toBeTruthy()
})

test('pressing Escape calls onClose', () => {
  const onClose = vi.fn()
  render(<Sheet contentId="mansion/28" onClose={onClose} />)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})
