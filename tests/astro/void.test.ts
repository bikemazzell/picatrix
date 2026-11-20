import { describe, expect, test } from 'vitest'
import { signIngresses, VOID_PLANETS, voidPeriods } from '../../src/astro'

const SEC = 1000
const DAY_MS = 86_400_000

function expectWithin(actual: Date, iso: string, tolSeconds: number) {
  expect(
    Math.abs(actual.getTime() - Date.parse(iso)),
    `${actual.toISOString()} vs ${iso}`,
  ).toBeLessThanOrEqual(tolSeconds * SEC)
}

describe('voidPeriods', () => {
  test('anchors the November 2026 voids to the DE440 fixture', () => {
    const periods = voidPeriods(new Date('2026-11-19T00:00:00Z'), new Date('2026-11-23T00:00:00Z'))
    expect(periods).toHaveLength(2)

    const pisces = periods[0]
    expect(pisces.sign).toBe(11)
    expectWithin(pisces.start, '2026-11-20T01:46:10Z', 60)
    expectWithin(pisces.end, '2026-11-20T05:52:14Z', 60)
    expect(pisces.lastAspect?.planet).toBe('Sun')
    expect(pisces.lastAspect?.angle).toBe(120)
    expectWithin(pisces.lastAspect!.time, '2026-11-20T01:46:10Z', 60)

    const aries = periods[1]
    expect(aries.sign).toBe(0)
    expectWithin(aries.start, '2026-11-22T07:38:36Z', 60)
    expectWithin(aries.end, '2026-11-22T10:09:42Z', 60)
    expect(aries.lastAspect?.planet).toBe('Mars')
    expect(aries.lastAspect?.angle).toBe(120)
    expectWithin(aries.lastAspect!.time, '2026-11-22T07:38:36Z', 60)
  })

  test('returns a period unclipped when the query lies wholly inside it', () => {
    const periods = voidPeriods(new Date('2026-11-22T08:00:00Z'), new Date('2026-11-22T09:00:00Z'))
    expect(periods).toHaveLength(1)
    expect(periods[0].sign).toBe(0)
    expectWithin(periods[0].start, '2026-11-22T07:38:36Z', 60)
    expectWithin(periods[0].end, '2026-11-22T10:09:42Z', 60)
    expect(periods[0].lastAspect?.planet).toBe('Mars')
  })

  test('returns a month-crossing period for queries on both months', () => {
    const october = voidPeriods(new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'))
    const november = voidPeriods(new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'))
    for (const periods of [october, november]) {
      const crossing = periods.find(
        p => Math.abs(p.end.getTime() - Date.parse('2026-11-01T04:18:11Z')) <= 60 * SEC,
      )
      expect(crossing, JSON.stringify(periods)).toBeDefined()
      expect(crossing!.sign).toBe(3)
      expectWithin(crossing!.start, '2026-10-31T21:59:38Z', 60)
      expect(crossing!.lastAspect?.planet).toBe('Venus')
      expect(crossing!.lastAspect?.angle).toBe(90)
    }
    const fromOctober = october.find(
      p => Math.abs(p.end.getTime() - Date.parse('2026-11-01T04:18:11Z')) <= 60 * SEC,
    )!
    const fromNovember = november.find(
      p => Math.abs(p.end.getTime() - Date.parse('2026-11-01T04:18:11Z')) <= 60 * SEC,
    )!
    expect(fromOctober.end.getTime()).toBeGreaterThan(Date.parse('2026-11-01T00:00:00Z'))
    expect(fromNovember.start.getTime()).toBeLessThan(Date.parse('2026-11-01T00:00:00Z'))
  })

  test('returns a period that starts exactly at the query start', () => {
    const periods = voidPeriods(new Date('2026-11-19T00:00:00Z'), new Date('2026-11-23T00:00:00Z'))
    const aries = periods.find(p => p.sign === 0)
    expect(aries).toBeDefined()
    const exact = voidPeriods(aries!.start, aries!.end)
    const again = exact.find(p => p.sign === 0)
    expect(again).toBeDefined()
    expect(Math.abs(again!.start.getTime() - aries!.start.getTime())).toBeLessThanOrEqual(2 * SEC)
    expect(Math.abs(again!.end.getTime() - aries!.end.getTime())).toBeLessThanOrEqual(2 * SEC)
  })

  test('VOID_PLANETS lists all nine planets', () => {
    expect([...VOID_PLANETS]).toEqual([
      'Sun',
      'Mercury',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
      'Pluto',
    ])
  })

  test(
    'a sign with no aspect to the queried planet voids from its ingress (1950-2050, Saturn)',
    () => {
      const periods = voidPeriods(
        new Date('1950-01-01T00:00:00Z'),
        new Date('2050-01-01T00:00:00Z'),
        ['Saturn'],
      )
      const bare = periods.find(p => p.lastAspect === null)
      expect(bare, 'expected at least one Saturn-free sign between 1950 and 2050').toBeDefined()
      expect(bare!.sign).toBe(4)
      expectWithin(bare!.start, '1950-01-05T13:57:32Z', 60)
      expectWithin(bare!.end, '1950-01-07T19:05:35Z', 60)
      const ingresses = signIngresses(new Date(bare!.start.getTime() - 4 * DAY_MS), bare!.end)
      const ingress = ingresses.find(e => e.sign === bare!.sign)
      expect(ingress).toBeDefined()
      expect(Math.abs(ingress!.time.getTime() - bare!.start.getTime())).toBeLessThanOrEqual(2 * SEC)
    },
    300_000,
  )
})
