import { describe, expect, test } from 'vitest'
import {
  illumination,
  mansionIngresses,
  moonAspects,
  phaseEvents,
  signIngresses,
} from '../../src/astro'
import { expectWithin } from './helpers'

describe('signIngresses', () => {
  test('returns the DE440 fixture ingresses for 2026-11-19..2026-11-23', () => {
    const events = signIngresses(
      new Date('2026-11-19T00:00:00Z'),
      new Date('2026-11-23T00:00:00Z'),
    )
    expect(events.map(e => e.sign)).toEqual([0, 1])
    expectWithin(events[0].time, '2026-11-20T05:52:14Z', 60)
    expectWithin(events[1].time, '2026-11-22T10:09:42Z', 60)
  })
})

describe('mansionIngresses', () => {
  test('returns the DE440 fixture ingresses for 2026-11-19..2026-11-24', () => {
    const events = mansionIngresses(
      new Date('2026-11-19T00:00:00Z'),
      new Date('2026-11-24T00:00:00Z'),
    )
    expect(events.map(e => e.mansion)).toEqual([28, 1, 2, 3, 4, 5])
    expectWithin(events[2].time, '2026-11-21T04:46:54Z', 60)
    expectWithin(events[4].time, '2026-11-23T00:25:14Z', 60)
  })
})

describe('phaseEvents', () => {
  test('contains the full moon of 2026-11-24 at the DE440 fixture time', () => {
    const events = phaseEvents(
      new Date('2026-11-19T00:00:00Z'),
      new Date('2026-11-26T00:00:00Z'),
    )
    expect(events.map(e => e.quarter)).toEqual([2])
    expectWithin(events[0].time, '2026-11-24T14:53:34Z', 60)
  })
})

describe('moonAspects', () => {
  test('contains the Mars trine of 2026-11-22 at the DE440 fixture time', () => {
    const events = moonAspects(
      new Date('2026-11-19T00:00:00Z'),
      new Date('2026-11-26T00:00:00Z'),
      ['Mars'],
    )
    expect(events.map(e => e.angle)).toEqual([120, 90])
    expectWithin(events[0].time, '2026-11-22T07:38:36Z', 60)
    expectWithin(events[1].time, '2026-11-24T10:09:12Z', 60)
  })
})

describe('illumination', () => {
  test('is nearly full and waxing before the 2026-11-24 full moon', () => {
    const state = illumination(new Date('2026-11-24T12:00:00Z'))
    expect(state.waxing).toBe(true)
    expect(state.fraction).toBeGreaterThan(0.97)
    expect(state.fraction).toBeLessThanOrEqual(1)
  })

  test('is waning the day after the full moon', () => {
    const state = illumination(new Date('2026-11-25T12:00:00Z'))
    expect(state.waxing).toBe(false)
    expect(state.fraction).toBeGreaterThan(0.9)
  })

  test('is dark and waxing just after the 2026-11-09 new moon', () => {
    const state = illumination(new Date('2026-11-09T08:02:07Z'))
    expect(state.waxing).toBe(true)
    expect(state.fraction).toBeLessThan(0.01)
  })
})
