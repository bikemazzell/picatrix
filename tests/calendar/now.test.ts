import { describe, expect, test } from 'vitest'
import { signIngresses } from '../../src/astro'
import { nowSummary, stepEvent } from '../../src/calendar/now'
import { SEC, expectWithin } from '../astro/helpers'

const T0 = new Date('2026-11-20T15:28:00Z')
const MOON_TOL = 60
const MERCURY_TOL = 600

const ARIES = '2026-11-20T05:52:14Z'
const TAURUS = '2026-11-22T10:09:42Z'
const PISCES = '2026-11-17T21:19:27Z'

describe('nowSummary at 2026-11-20T15:28Z', () => {
  const now = nowSummary(T0)

  test('sign card: Aries since the ingress, until Taurus', () => {
    expect(now.sign.current).toBe(0)
    expectWithin(now.sign.since!, ARIES, MOON_TOL)
    expectWithin(now.sign.until!, TAURUS, MOON_TOL)
  })

  test('void card: inactive, next period begins Nov 22 02:38 local', () => {
    expect(now.void.active).toBeNull()
    expectWithin(now.void.next.start, '2026-11-22T07:38:36Z', MOON_TOL)
    expectWithin(now.void.next.end, TAURUS, MOON_TOL)
  })

  test('mansion card: mansion 1 since the ingress, until mansion 2 on Nov 21', () => {
    expect(now.mansion.current).toBe(1)
    expectWithin(now.mansion.since!, ARIES, MOON_TOL)
    expectWithin(now.mansion.until!, '2026-11-21T04:46:54Z', MOON_TOL)
  })

  test('phase card: waxing toward the Full Moon of Nov 24', () => {
    expect(now.phase.current.waxing).toBe(true)
    expect(now.phase.current.illumination).toBeGreaterThan(0)
    expect(now.phase.current.illumination).toBeLessThan(1)
    expect(now.phase.current.nextEvent.quarter).toBe(2)
    expectWithin(now.phase.current.nextEvent.time, '2026-11-24T14:53:34Z', MOON_TOL)
    expectWithin(now.phase.since!, '2026-11-17T11:47:50Z', MOON_TOL)
    expect(now.phase.until!.getTime()).toBe(now.phase.current.nextEvent.time.getTime())
  })

  test('mercury: leaving until the post-shadow, next cycle in January', () => {
    expect(now.mercury.state).toBe('leaving')
    expectWithin(now.mercury.until!, '2026-11-30T06:16:56Z', 120)
    expect(now.mercury.next.getTime()).toBeGreaterThanOrEqual(Date.parse('2027-01-25T00:00:00Z'))
    expect(now.mercury.next.getTime()).toBeLessThan(Date.parse('2027-01-26T00:00:00Z'))
  })
})

describe('nowSummary inside an active void', () => {
  test('at 2026-11-22T09:00Z the card shows the active period and the one after it', () => {
    const now = nowSummary(new Date('2026-11-22T09:00:00Z'))
    expect(now.void.active).not.toBeNull()
    expectWithin(now.void.active!.start, '2026-11-22T07:38:36Z', MOON_TOL)
    expect(now.void.next.start.getTime()).toBeGreaterThan(now.void.active!.end.getTime())
    expect(now.void.next.start.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-11-24T05:00:00Z'))
    expect(now.void.next.start.getTime()).toBeLessThan(Date.parse('2026-11-25T05:00:00Z'))
  })
})

describe("stepEvent('sign')", () => {
  test('forward from mid-Aries is the Taurus ingress', () => {
    expectWithin(stepEvent('sign', T0, 1), TAURUS, MOON_TOL)
  })

  test('backward from mid-Aries is the moment Pisces began, not the Aries ingress', () => {
    const prev = stepEvent('sign', T0, -1)
    expectWithin(prev, PISCES, MOON_TOL)
    expect(Math.abs(prev.getTime() - Date.parse(ARIES))).toBeGreaterThan(MOON_TOL * SEC)
  })

  test('backward from the fixture Aries instant still returns the Pisces ingress', () => {
    expectWithin(stepEvent('sign', new Date(ARIES), -1), PISCES, MOON_TOL)
  })

  test('at the exact engine Aries ingress (within search convergence): backward is Pisces, forward is Taurus', () => {
    const aries = signIngresses(new Date('2026-11-18T00:00:00Z'), new Date('2026-11-21T00:00:00Z'))
      .find(s => s.sign === 0)!
    const t = new Date(aries.time.getTime() + 2 * SEC)
    expectWithin(stepEvent('sign', t, -1), PISCES, MOON_TOL)
    expectWithin(stepEvent('sign', t, 1), TAURUS, MOON_TOL)
  })
})

describe("stepEvent('mansion')", () => {
  test('forward is the mansion 2 ingress, backward is the mansion 28 ingress', () => {
    expectWithin(stepEvent('mansion', T0, 1), '2026-11-21T04:46:54Z', MOON_TOL)
    expectWithin(stepEvent('mansion', T0, -1), '2026-11-19T06:09:10Z', MOON_TOL)
  })
})

describe("stepEvent('phase')", () => {
  test('forward is the Full Moon, backward is the first quarter', () => {
    expectWithin(stepEvent('phase', T0, 1), '2026-11-24T14:53:34Z', MOON_TOL)
    expectWithin(stepEvent('phase', T0, -1), '2026-11-17T11:47:50Z', MOON_TOL)
  })
})

describe("stepEvent('void')", () => {
  test('from an inactive moment: backward is the end of the last period, forward the next start', () => {
    expectWithin(stepEvent('void', T0, -1), ARIES, MOON_TOL)
    expectWithin(stepEvent('void', T0, 1), '2026-11-22T07:38:36Z', MOON_TOL)
  })

  test('from an active moment: backward is the end of the previous period, forward the current end', () => {
    const t = new Date('2026-11-22T09:00:00Z')
    expectWithin(stepEvent('void', t, -1), ARIES, MOON_TOL)
    expectWithin(stepEvent('void', t, 1), TAURUS, MOON_TOL)
  })
})

describe("stepEvent('mercury')", () => {
  test("from 'leaving': backward is the retrograde station that started the previous state, forward the post-shadow end", () => {
    expectWithin(stepEvent('mercury', T0, -1), '2026-10-24T07:12:40Z', MERCURY_TOL)
    expectWithin(stepEvent('mercury', T0, 1), '2026-11-30T06:16:56Z', 120)
  })

  test("from 'none': backward is the end of the last completed cycle, forward the next pre-shadow", () => {
    const t = new Date('2026-09-15T12:00:00Z')
    expectWithin(stepEvent('mercury', t, -1), '2026-08-07T03:36:53Z', MERCURY_TOL)
    expectWithin(stepEvent('mercury', t, 1), '2026-10-04T09:10:52Z', MERCURY_TOL)
  })
})
