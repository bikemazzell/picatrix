import { describe, expect, test } from 'vitest'
import { daySummary } from '../../src/calendar/day'
import { SEC, expectWithin } from '../astro/helpers'

const TZ = 'America/New_York'
const MOON_TOL = 60
const MERCURY_TOL = 600

const ARIES = '2026-11-20T05:52:14Z'
const TAURUS = '2026-11-22T10:09:42Z'
const MANSION_2 = '2026-11-21T04:46:54Z'
const MANSION_4 = '2026-11-23T00:25:14Z'

describe('daySummary 2026-11-20 (screenshot day)', () => {
  const day = daySummary({ y: 2026, m: 11, d: 20 }, TZ)

  test('signs: Pisces until 00:52, then Aries from 00:52 running past the day edge', () => {
    expect(day.signs).toHaveLength(2)
    expect(day.signs[0]).toMatchObject({ value: 11, from: null })
    expectWithin(day.signs[0].until!, ARIES, MOON_TOL)
    expect(day.signs[1]).toMatchObject({ value: 0, until: null })
    expectWithin(day.signs[1].from!, ARIES, MOON_TOL)
  })

  test('mansions: 28 until 00:52, 1 from 00:52 until 23:46, then 2 from 23:46', () => {
    expect(day.mansions).toHaveLength(3)
    expect(day.mansions[0]).toMatchObject({ value: 28, from: null })
    expectWithin(day.mansions[0].until!, ARIES, MOON_TOL)
    expect(day.mansions[1].value).toBe(1)
    expectWithin(day.mansions[1].from!, ARIES, MOON_TOL)
    expectWithin(day.mansions[1].until!, MANSION_2, MOON_TOL)
    expect(day.mansions[2]).toMatchObject({ value: 2, until: null })
    expectWithin(day.mansions[2].from!, MANSION_2, MOON_TOL)
  })

  test('voids: one period ending 00:52, unclipped start at 20:46 the previous evening', () => {
    expect(day.voids).toHaveLength(1)
    const period = day.voids[0]
    expectWithin(period.start, '2026-11-20T01:46:10Z', MOON_TOL)
    expectWithin(period.end, ARIES, MOON_TOL)
    expect(period.sign).toBe(11)
    expect(period.lastAspect).toMatchObject({ planet: 'Sun', angle: 120 })
  })

  test('phase: waxing with no quarter event that day', () => {
    expect(day.phase.waxing).toBe(true)
    expect(day.phase.event).toBeNull()
  })

  test('mercury: leaving, until the post-shadow ends Nov 30, next cycle Jan 25, no transitions', () => {
    expect(day.mercury.state).toBe('leaving')
    expectWithin(day.mercury.until!, '2026-11-30T06:16:56Z', 120)
    expect(day.mercury.next.getTime()).toBeGreaterThanOrEqual(Date.parse('2027-01-25T00:00:00Z'))
    expect(day.mercury.next.getTime()).toBeLessThan(Date.parse('2027-01-26T00:00:00Z'))
    expect(day.mercury.transitions).toEqual([])
  })
})

describe('daySummary 2026-11-22', () => {
  const day = daySummary({ y: 2026, m: 11, d: 22 }, TZ)

  test('void from 02:38 to 05:09 local', () => {
    expect(day.voids).toHaveLength(1)
    expectWithin(day.voids[0].start, '2026-11-22T07:38:36Z', MOON_TOL)
    expectWithin(day.voids[0].end, TAURUS, MOON_TOL)
    expect(day.voids[0].lastAspect).toMatchObject({ planet: 'Mars', angle: 120 })
  })

  test('mansions: 3 from the day edge until 19:25, then 4', () => {
    expect(day.mansions).toHaveLength(2)
    expect(day.mansions[0]).toMatchObject({ value: 3, from: null })
    expectWithin(day.mansions[0].until!, MANSION_4, MOON_TOL)
    expect(day.mansions[1].value).toBe(4)
    expectWithin(day.mansions[1].from!, MANSION_4, MOON_TOL)
    expect(day.mansions[1].until).toBeNull()
  })

  test('signs: Aries until the Taurus ingress at 05:09, then Taurus', () => {
    expect(day.signs).toHaveLength(2)
    expect(day.signs[0]).toMatchObject({ value: 0, from: null })
    expectWithin(day.signs[0].until!, TAURUS, MOON_TOL)
    expect(day.signs[1].value).toBe(1)
    expectWithin(day.signs[1].from!, TAURUS, MOON_TOL)
    expect(day.signs[1].until).toBeNull()
  })
})

describe('Review Focus 3: a void crossing local midnight appears on both days', () => {
  const oct31 = daySummary({ y: 2026, m: 10, d: 31 }, TZ)
  const nov1 = daySummary({ y: 2026, m: 11, d: 1 }, TZ)

  test('the same period is listed on October 31 and on November 1', () => {
    const onOct = oct31.voids.find(v => Math.abs(v.end.getTime() - Date.parse('2026-11-01T04:18:11Z')) <= MOON_TOL * SEC)
    const onNov = nov1.voids.find(v => Math.abs(v.end.getTime() - Date.parse('2026-11-01T04:18:11Z')) <= MOON_TOL * SEC)
    expect(onOct).toBeDefined()
    expect(onNov).toBeDefined()
    expect(onNov!.start.getTime()).toBe(onOct!.start.getTime())
    expect(onNov!.end.getTime()).toBe(onOct!.end.getTime())
  })

  test('the period starts at the Venus square on October 31 and ends at the Leo ingress on November 1', () => {
    const onNov = nov1.voids[0]
    expectWithin(onNov.start, '2026-10-31T21:59:38Z', MOON_TOL)
    expectWithin(onNov.end, '2026-11-01T04:18:11Z', MOON_TOL)
    expect(onNov.lastAspect).toMatchObject({ planet: 'Venus', angle: 90 })
  })
})

describe('Review Focus 1: the 25-hour fall-back day lists each event once', () => {
  const day = daySummary({ y: 2026, m: 11, d: 1 }, TZ)

  test('one sign ingress, one mansion ingress, one void, one quarter', () => {
    expect(day.signs).toHaveLength(2)
    expect(day.signs[0]).toMatchObject({ value: 3, from: null })
    expectWithin(day.signs[0].until!, '2026-11-01T04:18:11Z', MOON_TOL)
    expect(day.signs[1].value).toBe(4)
    expect(day.signs[1].from!.getTime()).toBe(day.signs[0].until!.getTime())
    expect(day.signs[1].until).toBeNull()

    expect(day.mansions).toHaveLength(2)
    expect(day.mansions[0]).toMatchObject({ value: 10, from: null })
    expectWithin(day.mansions[0].until!, '2026-11-01T18:59:35Z', MOON_TOL)
    expect(day.mansions[1].value).toBe(11)
    expect(day.mansions[1].until).toBeNull()

    expect(day.voids).toHaveLength(1)

    expect(day.phase.event).not.toBeNull()
    expect(day.phase.event!.quarter).toBe(3)
    expectWithin(day.phase.event!.time, '2026-11-01T20:28:27Z', MOON_TOL)
  })
})

describe('Mercury station days list their transition', () => {
  test('October 24: approaching at midnight, station retrograde at 03:14 local', () => {
    const day = daySummary({ y: 2026, m: 10, d: 24 }, TZ)
    expect(day.mercury.state).toBe('approaching')
    expect(day.mercury.transitions).toHaveLength(1)
    expect(day.mercury.transitions[0].to).toBe('retrograde')
    expectWithin(day.mercury.transitions[0].time, '2026-10-24T07:12:40Z', MERCURY_TOL)
  })

  test('November 13: retrograde at midnight, station direct at 10:52 local', () => {
    const day = daySummary({ y: 2026, m: 11, d: 13 }, TZ)
    expect(day.mercury.state).toBe('retrograde')
    expect(day.mercury.transitions).toHaveLength(1)
    expect(day.mercury.transitions[0].to).toBe('leaving')
    expectWithin(day.mercury.transitions[0].time, '2026-11-13T15:53:54Z', MERCURY_TOL)
  })
})

describe('Review Focus 2: an event belongs to the local date of its local time', () => {
  test('the Last Quarter at 2026-11-01T20:28Z is on November 2 in Auckland, not November 1', () => {
    expect(daySummary({ y: 2026, m: 11, d: 1 }, 'Pacific/Auckland').phase.event).toBeNull()
    const nov2 = daySummary({ y: 2026, m: 11, d: 2 }, 'Pacific/Auckland').phase.event
    expect(nov2).not.toBeNull()
    expect(nov2!.quarter).toBe(3)
    expectWithin(nov2!.time, '2026-11-01T20:28:27Z', 60)
  })

  test('the November 22 void lands on 13:08-15:39 local in Kolkata, same UTC instants', () => {
    const day = daySummary({ y: 2026, m: 11, d: 22 }, 'Asia/Kolkata')
    expect(day.voids).toHaveLength(1)
    expectWithin(day.voids[0].start, '2026-11-22T07:38:36Z', 60)
    expectWithin(day.voids[0].end, '2026-11-22T10:09:42Z', 60)
  })
})

describe('outside the supported range', () => {
  test('a day in 2101 yields empty summaries instead of errors', () => {
    const day = daySummary({ y: 2101, m: 1, d: 1 }, TZ)
    expect(day.signs).toEqual([])
    expect(day.mansions).toEqual([])
    expect(day.voids).toEqual([])
    expect(day.phase.event).toBeNull()
    expect(day.mercury.state).toBe('none')
    expect(day.mercury.until).toBeNull()
    expect(day.mercury.transitions).toEqual([])
    expect(day.mercury.next.getTime()).not.toBeNaN()
  })
})
