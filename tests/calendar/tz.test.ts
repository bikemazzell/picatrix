import { describe, expect, test } from 'vitest'
import {
  addDays,
  dayBounds,
  fromLocal,
  isValidTimeZone,
  toLocal,
} from '../../src/calendar/tz'

const HOUR = 3_600_000

describe('dayBounds', () => {
  test('a spring-forward day in New York spans 23 hours', () => {
    const { start, end } = dayBounds({ y: 2026, m: 3, d: 8 }, 'America/New_York')
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(23 * HOUR)
  })

  test('a fall-back day in New York spans 25 hours', () => {
    const { start, end } = dayBounds({ y: 2026, m: 11, d: 1 }, 'America/New_York')
    expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-02T05:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(25 * HOUR)
  })

  test('a Kolkata day starts at 18:30Z of the previous UTC day', () => {
    const { start, end } = dayBounds({ y: 2026, m: 11, d: 20 }, 'Asia/Kolkata')
    expect(start.toISOString()).toBe('2026-11-19T18:30:00.000Z')
    expect(end.toISOString()).toBe('2026-11-20T18:30:00.000Z')
  })

  test('a day whose local midnight is skipped starts at the jump instant', () => {
    const { start, end } = dayBounds({ y: 2026, m: 3, d: 8 }, 'America/Havana')
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    const local = toLocal(start, 'America/Havana')
    expect(`${local.d} ${local.h}:${String(local.min).padStart(2, '0')}`).toBe('8 1:00')
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(23 * HOUR)
  })
})

describe('toLocal', () => {
  test('maps a UTC instant onto New York wall time', () => {
    const local = toLocal(new Date('2026-11-20T05:51:00Z'), 'America/New_York')
    expect(local).toMatchObject({ y: 2026, m: 11, d: 20, h: 0, min: 51, weekday: 5 })
  })

  test('crosses the date line into the next Auckland day', () => {
    const local = toLocal(new Date('2026-11-20T11:00:00Z'), 'Pacific/Auckland')
    expect(local).toMatchObject({ y: 2026, m: 11, d: 21, h: 0, min: 0, weekday: 6 })
  })

  test('uses weekday 1 for Monday through 7 for Sunday', () => {
    expect(toLocal(new Date('2026-11-16T12:00:00Z'), 'UTC').weekday).toBe(1)
    expect(toLocal(new Date('2026-11-22T12:00:00Z'), 'UTC').weekday).toBe(7)
  })
})

describe('fromLocal', () => {
  test('inverts toLocal for a Kolkata wall time', () => {
    const t = fromLocal({ y: 2026, m: 11, d: 20 }, 9, 0, 'Asia/Kolkata')
    expect(t.toISOString()).toBe('2026-11-20T03:30:00.000Z')
    expect(toLocal(t, 'Asia/Kolkata')).toMatchObject({ y: 2026, m: 11, d: 20, h: 9, min: 0 })
  })

  test('maps a fall-back time to the earlier occurrence in New York', () => {
    const t = fromLocal({ y: 2026, m: 11, d: 1 }, 1, 30, 'America/New_York')
    expect(t.toISOString()).toBe('2026-11-01T05:30:00.000Z')
  })

  test('maps a fall-back time to the earlier occurrence in London', () => {
    const t = fromLocal({ y: 2026, m: 10, d: 25 }, 1, 30, 'Europe/London')
    expect(t.toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })

  test('shifts a nonexistent spring-forward time by the gap length', () => {
    const t = fromLocal({ y: 2026, m: 3, d: 8 }, 2, 30, 'America/New_York')
    expect(t.toISOString()).toBe('2026-03-08T08:30:00.000Z')
  })

  test('resolves normal wall times on both sides of a New York clock change', () => {
    expect(fromLocal({ y: 2026, m: 3, d: 8 }, 1, 30, 'America/New_York').toISOString()).toBe(
      '2026-03-08T06:30:00.000Z',
    )
    expect(fromLocal({ y: 2026, m: 3, d: 8 }, 3, 30, 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    )
    expect(fromLocal({ y: 2026, m: 11, d: 1 }, 2, 30, 'America/New_York').toISOString()).toBe(
      '2026-11-01T07:30:00.000Z',
    )
  })
})

describe('addDays', () => {
  test('rolls over months, years, and leap February', () => {
    expect(addDays({ y: 2026, m: 1, d: 31 }, 1)).toEqual({ y: 2026, m: 2, d: 1 })
    expect(addDays({ y: 2024, m: 2, d: 28 }, 1)).toEqual({ y: 2024, m: 2, d: 29 })
    expect(addDays({ y: 2026, m: 2, d: 28 }, 1)).toEqual({ y: 2026, m: 3, d: 1 })
    expect(addDays({ y: 2026, m: 12, d: 31 }, 1)).toEqual({ y: 2027, m: 1, d: 1 })
    expect(addDays({ y: 2026, m: 3, d: 1 }, -1)).toEqual({ y: 2026, m: 2, d: 28 })
    expect(addDays({ y: 2026, m: 11, d: 20 }, 0)).toEqual({ y: 2026, m: 11, d: 20 })
  })
})

describe('isValidTimeZone', () => {
  test('accepts real zones and rejects the rest', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true)
    expect(isValidTimeZone('Europe/London')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('America/Nowhere')).toBe(false)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})
