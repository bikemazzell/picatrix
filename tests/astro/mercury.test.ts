import { describe, expect, test } from 'vitest'
import { mercuryCycles, mercuryStateAt, type MercuryCycle } from '../../src/astro'
import { SEC, expectWithin } from './helpers'

const EPS_MS = 60 * SEC

function novemberCycle(): MercuryCycle {
  const nov = mercuryCycles(
    new Date('2026-11-01T00:00:00Z'),
    new Date('2026-12-01T00:00:00Z'),
  ).find(
    c =>
      c.stationDirect >= new Date('2026-11-01T00:00:00Z') &&
      c.stationDirect < new Date('2026-12-01T00:00:00Z'),
  )
  expect(nov).toBeDefined()
  return nov!
}

describe('mercuryCycles', () => {
  test('2026 contains the November cycle and the whole year has both station directions', () => {
    const yearStart = new Date('2026-01-01T00:00:00Z')
    const yearEnd = new Date('2027-01-01T00:00:00Z')
    const cycles = mercuryCycles(yearStart, yearEnd)
    expect(cycles.length).toBeGreaterThanOrEqual(2)
    for (const cycle of cycles) {
      expect(cycle.preShadowStart < cycle.stationRetro).toBe(true)
      expect(cycle.stationRetro < cycle.stationDirect).toBe(true)
      expect(cycle.stationDirect < cycle.postShadowEnd).toBe(true)
    }
    const inYear = cycles.filter(c => c.stationRetro >= yearStart && c.stationRetro < yearEnd)
    expect(inYear).toHaveLength(3)

    const nov = novemberCycle()
    expectWithin(nov.stationRetro, '2026-10-24T07:12:40Z', 600)
    expectWithin(nov.stationDirect, '2026-11-13T15:53:54Z', 600)
  })

  test('cycles stay complete at the far edge of the supported range (2100)', () => {
    const cycles = mercuryCycles(new Date('2100-01-01T00:00:00Z'), new Date('2101-01-01T00:00:00Z'))
    expect(cycles.length).toBeGreaterThanOrEqual(2)
    for (const cycle of cycles) {
      expect(cycle.preShadowStart < cycle.stationRetro).toBe(true)
      expect(cycle.stationRetro < cycle.stationDirect).toBe(true)
      expect(cycle.stationDirect < cycle.postShadowEnd).toBe(true)
    }
  })
})

describe('mercuryStateAt', () => {
  test('2026-11-20 is leaving the November cycle, until Nov 30 in New York, next on 2027-01-25', () => {
    const { state, until, next } = mercuryStateAt(new Date('2026-11-20T15:28:00Z'))
    expect(state).toBe('leaving')
    expect(until).not.toBeNull()
    const nyMidnightNov30Utc = Date.parse('2026-11-30T05:00:00Z')
    const nyMidnightDec1Utc = Date.parse('2026-12-01T05:00:00Z')
    expect(until!.getTime()).toBeGreaterThanOrEqual(nyMidnightNov30Utc)
    expect(until!.getTime()).toBeLessThan(nyMidnightDec1Utc)
    expect(next.getTime()).toBeGreaterThanOrEqual(Date.parse('2027-01-25T00:00:00Z'))
    expect(next.getTime()).toBeLessThan(Date.parse('2027-01-26T00:00:00Z'))
  })

  test('state flips at each cycle boundary, tested from both sides', () => {
    const nov = novemberCycle()
    const stateAt = (t: number) => mercuryStateAt(new Date(t)).state
    expect(stateAt(nov.preShadowStart.getTime() - EPS_MS)).toBe('none')
    expect(stateAt(nov.preShadowStart.getTime() + EPS_MS)).toBe('approaching')
    expect(stateAt(nov.stationRetro.getTime() - EPS_MS)).toBe('approaching')
    expect(stateAt(nov.stationRetro.getTime() + EPS_MS)).toBe('retrograde')
    expect(stateAt(nov.stationDirect.getTime() - EPS_MS)).toBe('retrograde')
    expect(stateAt(nov.stationDirect.getTime() + EPS_MS)).toBe('leaving')
    expect(stateAt(nov.postShadowEnd.getTime() - EPS_MS)).toBe('leaving')
    expect(stateAt(nov.postShadowEnd.getTime() + EPS_MS)).toBe('none')
  })

  test('until reports the end of the current state and next the next pre-shadow', () => {
    const nov = novemberCycle()
    const approaching = mercuryStateAt(new Date(nov.preShadowStart.getTime() + EPS_MS))
    expect(approaching.state).toBe('approaching')
    expect(Math.abs(approaching.until!.getTime() - nov.stationRetro.getTime())).toBeLessThanOrEqual(2 * SEC)
    const retrograde = mercuryStateAt(new Date(nov.stationRetro.getTime() + EPS_MS))
    expect(retrograde.state).toBe('retrograde')
    expect(Math.abs(retrograde.until!.getTime() - nov.stationDirect.getTime())).toBeLessThanOrEqual(2 * SEC)
    const leaving = mercuryStateAt(new Date(nov.stationDirect.getTime() + EPS_MS))
    expect(leaving.state).toBe('leaving')
    expect(Math.abs(leaving.until!.getTime() - nov.postShadowEnd.getTime())).toBeLessThanOrEqual(2 * SEC)
    expect(leaving.until!.getTime()).toBeGreaterThan(Date.parse('2026-11-20T15:28:00Z'))
    const none = mercuryStateAt(new Date(nov.postShadowEnd.getTime() + EPS_MS))
    expect(none.state).toBe('none')
    expect(none.until).toEqual(none.next)
    expect(none.next.getTime()).toBeGreaterThan(nov.postShadowEnd.getTime())
    const inside = mercuryStateAt(new Date(nov.preShadowStart.getTime() + EPS_MS))
    expect(inside.next.getTime()).toBeGreaterThan(nov.postShadowEnd.getTime())
  })
})
