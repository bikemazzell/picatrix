import { describe, expect, test } from 'vitest'
import { findAngleCrossings } from '../../src/astro/search'

const T0 = Date.UTC(2026, 0, 1)
const date = (hours: number) => new Date(T0 + hours * 3_600_000)
const hoursSince = (t: Date) => (t.getTime() - T0) / 3_600_000
const SEC = 1000

describe('findAngleCrossings', () => {
  test('finds a target crossed via the 360-to-0 wrap', () => {
    const fn = (t: Date) => 350 + 5 * hoursSince(t)
    const roots = findAngleCrossings(fn, 0, date(0), date(4), 0.5)
    expect(roots).toHaveLength(1)
    expect(Math.abs(roots[0].getTime() - date(2).getTime())).toBeLessThanOrEqual(2 * SEC)
  })

  test('root exactly on a sample point is found once, exactly', () => {
    const fn = (t: Date) => hoursSince(t) - 1
    const roots = findAngleCrossings(fn, 0, date(0), date(4), 1)
    expect(roots).toHaveLength(1)
    expect(roots[0].getTime()).toBe(date(1).getTime())
  })

  test('root exactly at start is kept', () => {
    const fn = (t: Date) => hoursSince(t) - 1
    const roots = findAngleCrossings(fn, 0, date(1), date(4), 1)
    expect(roots).toHaveLength(1)
    expect(roots[0].getTime()).toBe(date(1).getTime())
  })

  test('root exactly at end is dropped', () => {
    const fn = (t: Date) => hoursSince(t) - 4
    const roots = findAngleCrossings(fn, 0, date(0), date(4), 1)
    expect(roots).toHaveLength(0)
  })

  test('two crossings inside one sampling interval need the smaller step', () => {
    const fn = (t: Date) => 0.5 - 4 * (hoursSince(t) - 0.5) ** 2
    expect(findAngleCrossings(fn, 0, date(0), date(1), 1)).toHaveLength(0)
    const roots = findAngleCrossings(fn, 0, date(0), date(1), 0.25)
    expect(roots).toHaveLength(2)
    const lower = 0.5 - Math.sqrt(0.125)
    const upper = 0.5 + Math.sqrt(0.125)
    expect(Math.abs(roots[0].getTime() - date(lower).getTime())).toBeLessThanOrEqual(2 * SEC)
    expect(Math.abs(roots[1].getTime() - date(upper).getTime())).toBeLessThanOrEqual(2 * SEC)
  })

  test('a 360-degree jump is not reported as a crossing', () => {
    const fn = (t: Date) => (31 * hoursSince(t)) % 360
    const roots = findAngleCrossings(fn, 90, date(0), date(24), 3)
    const hours = roots.map(r => (r.getTime() - T0) / 3_600_000)
    expect(hours).toHaveLength(2)
    expect(Math.abs(hours[0] - 90 / 31)).toBeLessThanOrEqual(2 / 3600)
    expect(Math.abs(hours[1] - 450 / 31)).toBeLessThanOrEqual(2 / 3600)
  })
})
