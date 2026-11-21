import { describe, expect, test } from 'vitest'
import { eventsFor } from '../../src/calendar/cache'
import { monthGrid } from '../../src/calendar/month'
import type { MonthCell } from '../../src/calendar/types'

const TZ = 'America/New_York'

function cell(cells: MonthCell[], d: number): MonthCell {
  const hit = cells.find(c => c.date.y === 2026 && c.date.m === 11 && c.date.d === d)
  expect(hit).toBeDefined()
  return hit!
}

describe('monthGrid(2026, 11, America/New_York)', () => {
  const cells = monthGrid(2026, 11, TZ)

  test('returns 42 Monday-first cells starting 2026-10-26', () => {
    expect(cells).toHaveLength(42)
    expect(cells[0].date).toEqual({ y: 2026, m: 10, d: 26 })
    expect(cells[41].date).toEqual({ y: 2026, m: 12, d: 6 })
    expect(cells.every((c, i) => i === 0 ||
      (c.date.y === cells[i - 1].date.y && c.date.m === cells[i - 1].date.m && c.date.d === cells[i - 1].date.d + 1) ||
      (c.date.d === 1 && cells[i - 1].date.d >= 28))).toBe(true)
    expect(cells.filter(c => c.inMonth)).toHaveLength(30)
  })

  test('the mansion at 23:59: Nov 19 is 28, Nov 20 is 2', () => {
    expect(cell(cells, 19).mansion).toBe(28)
    expect(cell(cells, 20).mansion).toBe(2)
  })

  test('phase events: New Moon on Nov 9, Full Moon on Nov 24', () => {
    expect(cell(cells, 9).phaseEvent).not.toBeNull()
    expect(cell(cells, 9).phaseEvent!.quarter).toBe(0)
    expect(cell(cells, 24).phaseEvent).not.toBeNull()
    expect(cell(cells, 24).phaseEvent!.quarter).toBe(2)
  })

  test('ingress: Aries on Nov 20, Gemini on Nov 24', () => {
    expect(cell(cells, 20).ingress).toMatchObject({ sign: 0 })
    expect(cell(cells, 24).ingress).toMatchObject({ sign: 2 })
  })

  test('mercuryRetro: Nov 1-12 true per the screenshot; the rule holds at both station edges', () => {
    for (let d = 1; d <= 12; d++) expect(cell(cells, d).mercuryRetro).toBe(true)
    expect(cell(cells, 13).mercuryRetro).toBe(true)
    expect(cell(cells, 14).mercuryRetro).toBe(false)
    const october = monthGrid(2026, 10, TZ)
    const oct23 = october.find(c => c.date.y === 2026 && c.date.m === 10 && c.date.d === 23)!
    const oct24 = october.find(c => c.date.y === 2026 && c.date.m === 10 && c.date.d === 24)!
    expect(oct23.mercuryRetro).toBe(false)
    expect(oct24.mercuryRetro).toBe(true)
  })

  test('every in-month strip covers 0 to 1 with no gaps (includes the 25-hour Nov 1)', () => {
    for (const c of cells.filter(x => x.inMonth)) {
      expect(c.strip.length).toBeGreaterThanOrEqual(1)
      expect(c.strip[0].from).toBe(0)
      expect(c.strip[c.strip.length - 1].to).toBe(1)
      for (let i = 1; i < c.strip.length; i++) {
        expect(c.strip[i].from).toBe(c.strip[i - 1].to)
      }
      for (const seg of c.strip) {
        expect(['fire', 'earth', 'air', 'water']).toContain(seg.element)
        expect(seg.to).toBeGreaterThan(seg.from)
      }
    }
  })

  test('Nov 20 strip: Pisces void until 00:52, then Aries clear', () => {
    const strip = cell(cells, 20).strip
    expect(strip).toHaveLength(2)
    expect(strip[0]).toMatchObject({ element: 'water', void: true })
    expect(strip[1]).toMatchObject({ element: 'fire', void: false })
    const ariesFraction = (52 + 14 / 60) / (24 * 60)
    expect(Math.abs(strip[1].from - ariesFraction)).toBeLessThan(0.002)
  })

  test('Nov 22 strip: Aries clear, Aries void, Taurus clear around the 02:38 and 05:09 edges', () => {
    const strip = cell(cells, 22).strip
    expect(strip).toHaveLength(3)
    expect(strip[0]).toMatchObject({ element: 'fire', void: false })
    expect(strip[1]).toMatchObject({ element: 'fire', void: true })
    expect(strip[2]).toMatchObject({ element: 'earth', void: false })
    const voidStart = (2 * 60 + 38 + 36 / 60) / (24 * 60)
    const taurus = (5 * 60 + 9 + 42 / 60) / (24 * 60)
    expect(Math.abs(strip[1].from - voidStart)).toBeLessThan(0.002)
    expect(Math.abs(strip[2].from - taurus)).toBeLessThan(0.002)
  })
})

describe('eventsFor cache', () => {
  test('memoizes by UTC month and reports a covered range that honors the padded request', () => {
    const a = eventsFor(new Date('2026-11-02T00:00:00Z'), new Date('2026-11-20T00:00:00Z'))
    const b = eventsFor(new Date('2026-11-05T00:00:00Z'), new Date('2026-11-25T00:00:00Z'))
    expect(b).toBe(a)
    expect(a.covered.start.getTime()).toBeLessThanOrEqual(Date.parse('2026-10-30T00:00:00Z'))
    expect(a.covered.end.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-11-23T00:00:00Z'))
  })

  test('the Mercury search reaches 60 days out so edge cycles come back complete', () => {
    const bundle = eventsFor(new Date('2026-12-15T00:00:00Z'), new Date('2026-12-16T00:00:00Z'))
    expect(bundle.mercury.length).toBeGreaterThanOrEqual(2)
    for (const cycle of bundle.mercury) {
      expect(cycle.preShadowStart < cycle.stationRetro).toBe(true)
      expect(cycle.stationRetro < cycle.stationDirect).toBe(true)
      expect(cycle.stationDirect < cycle.postShadowEnd).toBe(true)
    }
  })

  test('requests wholly outside 1900-2100 return empty lists', () => {
    const bundle = eventsFor(new Date('2101-06-01T00:00:00Z'), new Date('2101-06-02T00:00:00Z'))
    expect(bundle.phases).toEqual([])
    expect(bundle.signs).toEqual([])
    expect(bundle.mansions).toEqual([])
    expect(bundle.voids).toEqual([])
    expect(bundle.mercury).toEqual([])
  })
})

describe('monthGrid timing', () => {
  test('a new month is computed well inside the interaction budget', () => {
    const t0 = performance.now()
    const cells = monthGrid(2027, 8, TZ)
    const elapsed = performance.now() - t0
    console.log(`monthGrid(2027, 8, America/New_York) cold: ${elapsed.toFixed(1)} ms`)
    expect(cells).toHaveLength(42)
    expect(elapsed).toBeLessThan(2000)
  })
})
