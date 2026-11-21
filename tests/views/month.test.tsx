import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, expect, test } from 'vitest'
import { App } from '../../src/app'
import { toLocal } from '../../src/calendar/tz'
import { formatMonth } from '../../src/format'
import type { Feature } from '../../src/calendar/types'
import { Month } from '../../src/views/Month'

const TZ = 'America/New_York'
const AT = () => new Date('2026-11-20T15:28:00Z')

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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

function todayYM(): string {
  const t = toLocal(new Date(), TZ)
  return `${t.y}-${String(t.m).padStart(2, '0')}`
}

function openMonth(month: string) {
  location.hash = `#/month/${month}`
  return render(<App />)
}

function cell(container: Element, iso: string): HTMLElement {
  const [, m, d] = iso.split('-')
  const prefix = `${MONTHS[Number(m) - 1]} ${Number(d)},`
  const button = container.querySelector(`button.month-cell[aria-label^="${prefix}"]`)
  expect(button).not.toBeNull()
  return button as HTMLElement
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  location.hash = ''
})

test('renders 42 cells with the pinned Nov 2026 marks at the fixed clock', () => {
  seed()
  const { container } = render(<Month month="2026-11" now={AT} />)
  expect(container.querySelectorAll('.month-cell')).toHaveLength(42)
  expect(container.querySelectorAll('.month-cell.today')).toHaveLength(1)
  const nov20 = cell(container, '2026-11-20')
  expect(within(nov20).getByText('2')).toBeTruthy()
  expect(nov20.classList.contains('today')).toBe(true)
  expect(cell(container, '2026-11-21').classList.contains('today')).toBe(false)
})

test('shows the full Moon glyph on Nov 24 and the new Moon glyph on Nov 9', () => {
  seed()
  const { container } = render(<Month month="2026-11" now={AT} />)
  expect(
    within(cell(container, '2026-11-24')).getByLabelText('Waxing moon, 100% illuminated'),
  ).toBeTruthy()
  expect(
    within(cell(container, '2026-11-09')).getByLabelText('Waxing moon, 0% illuminated'),
  ).toBeTruthy()
})

test('shows the Aries glyph on Nov 20 and the Mercury mark on Nov 1 through 12', () => {
  seed()
  const { container } = render(<Month month="2026-11" now={AT} />)
  expect(within(cell(container, '2026-11-20')).getByLabelText('Aries')).toBeTruthy()
  for (let d = 1; d <= 12; d++) {
    const iso = `2026-11-${String(d).padStart(2, '0')}`
    expect(within(cell(container, iso)).queryByLabelText('Mercury')).toBeTruthy()
  }
  expect(within(cell(container, '2026-11-14')).queryByLabelText('Mercury')).toBeNull()
})

test('strip segments use the element and void CSS variables and fraction widths', () => {
  seed()
  const { container } = render(<Month month="2026-11" now={AT} />)
  const seen = new Set<string>()
  for (const seg of container.querySelectorAll('.month-seg')) {
    const background = (seg as HTMLElement).style.background
    for (const name of ['fire', 'earth', 'air', 'water', 'void']) {
      if (background.includes(`var(--${name})`)) seen.add(name)
    }
  }
  expect([...seen].sort()).toEqual(['air', 'earth', 'fire', 'void', 'water'])
  const nov20 = cell(container, '2026-11-20')
  const segments = [...nov20.querySelectorAll('.month-seg')] as HTMLElement[]
  expect(segments).toHaveLength(2)
  const fire = segments.find(seg => seg.style.background.includes('var(--fire)'))
  const voidSeg = segments.find(seg => seg.style.background.includes('var(--void)'))
  expect(fire).toBeDefined()
  expect(voidSeg).toBeDefined()
  expect(Math.abs(parseFloat(fire!.style.width) - 96.37)).toBeLessThan(0.3)
  expect(Math.abs(parseFloat(voidSeg!.style.width) - 3.63)).toBeLessThan(0.3)
})

test('cell labels name the date, mansion, and void of course', () => {
  seed()
  const { container } = render(<Month month="2026-11" now={AT} />)
  const labels = [...container.querySelectorAll('button.month-cell')].map(button =>
    button.getAttribute('aria-label') ?? '',
  )
  expect(labels).toHaveLength(42)
  expect(cell(container, '2026-11-20').getAttribute('aria-label')).toBe(
    'November 20, mansions 1 and 2, void of course',
  )
  expect(labels.some(label => !label.endsWith('void of course'))).toBe(true)
  for (const label of labels) {
    expect(label).toMatch(
      /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, (mansion \d{1,2}|mansions (\d{1,2}, )*\d{1,2} and \d{1,2})(, void of course)?$/,
    )
  }
})

test('clicking a cell routes to the day view', async () => {
  seed()
  const { container } = openMonth('2026-11')
  fireEvent.click(cell(container, '2026-11-22'))
  await waitFor(() => expect(location.hash).toBe('#/day/2026-11-22'))
})

test('previous and next month controls change the route', async () => {
  seed()
  openMonth('2026-11')
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  await waitFor(() => expect(location.hash).toBe('#/month/2026-12'))
  expect(await screen.findByText('December 2026')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  await waitFor(() => expect(location.hash).toBe('#/month/2026-11'))
})

test('previous month crosses the year boundary', async () => {
  seed()
  openMonth('2026-01')
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  await waitFor(() => expect(location.hash).toBe('#/month/2025-12'))
})

test('an invalid route month redirects to the current month in the effective time zone', async () => {
  seed()
  openMonth('2026-13')
  const now = todayYM()
  await waitFor(() => expect(location.hash).toBe(`#/month/${now}`))
  const [y, m] = now.split('-').map(Number)
  expect(await screen.findByText(formatMonth(y, m))).toBeTruthy()
})

test('a garbage month string rendered directly falls back to the current month', () => {
  seed()
  render(<Month month="20x6-???" />)
  const [y, m] = todayYM().split('-').map(Number)
  expect(screen.getByText(formatMonth(y, m))).toBeTruthy()
})

test('a month after 2100-12 shows a message instead of cells', () => {
  seed()
  const { container } = openMonth('2101-01')
  expect(
    screen.getByText('No data for this month. The ephemeris covers 1900-01-01 through 2100-12-31.'),
  ).toBeTruthy()
  expect(container.querySelectorAll('.month-cell')).toHaveLength(0)
})

test('a month before 1900-01 shows a message instead of cells', () => {
  seed()
  const { container } = render(<Month month="1899-12" />)
  expect(
    screen.getByText('No data for this month. The ephemeris covers 1900-01-01 through 2100-12-31.'),
  ).toBeTruthy()
  expect(container.querySelectorAll('.month-cell')).toHaveLength(0)
})

test('glyph marks respect the feature switches while the mansion number stays', () => {
  seed({ features: { phase: false, sign: false, mercury: false } })
  const { container } = render(<Month month="2026-11" now={AT} />)
  expect(within(cell(container, '2026-11-24')).queryByLabelText('Waxing moon, 100% illuminated')).toBeNull()
  expect(within(cell(container, '2026-11-20')).queryByLabelText('Aries')).toBeNull()
  expect(within(cell(container, '2026-11-05')).queryByLabelText('Mercury')).toBeNull()
  expect(within(cell(container, '2026-11-20')).getByText('2')).toBeTruthy()
})

test('a day with two mansion ingresses shows both badges', () => {
  seed()
  const { container } = render(<Month month="2026-11" now={AT} />)
  const badges = [...cell(container, '2026-11-20').querySelectorAll('.mansion-badge')]
  expect(badges.map(badge => badge.textContent)).toEqual(['1', '2'])
})

test('cells past 2100 are disabled and carry no data', () => {
  seed()
  const { container } = render(<Month month="2100-12" now={AT} />)
  const past = cell(container, '2101-01-01')
  expect(past.hasAttribute('disabled')).toBe(true)
  expect(past.getAttribute('aria-label')).toBe('January 1, no data')
  expect(past.querySelector('.mansion-badge')).toBeNull()
  expect(cell(container, '2100-12-31').hasAttribute('disabled')).toBe(false)
})
