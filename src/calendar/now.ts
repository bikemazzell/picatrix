import {
  illumination,
  mansionIngresses,
  mercuryCycles,
  mercuryStateAt,
  phaseEvents,
  signIngresses,
  voidPeriods,
  type VoidPeriod,
} from '../astro'
import { MAX_SUPPORTED_TIME, MIN_SUPPORTED_TIME } from './cache'
import { mercuryBoundaries, mansionAt, signAt } from './day'
import type { Feature, NowSummary } from './types'

const DAY_MS = 86_400_000
const MAX_WIDEN_DAYS = 4096

interface TimeEvent {
  time: Date
}

function last<T>(items: T[], predicate: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) return items[i]
  }
  return undefined
}

function searchAround<T extends TimeEvent>(
  t: Date,
  initialDays: number,
  search: (start: Date, end: Date) => T[],
): T[] {
  let days = initialDays
  for (;;) {
    const list = search(new Date(t.getTime() - days * DAY_MS), new Date(t.getTime() + days * DAY_MS))
    if (list.some(event => event.time <= t) && list.some(event => event.time > t)) return list
    if (days >= MAX_WIDEN_DAYS) {
      throw new Error(`no bracketing events within ${days} days of ${t.toISOString()}`)
    }
    days *= 2
  }
}

function card(t: Date, list: { time: Date; value: number }[], fallback: number) {
  let since: Date | null = null
  let current = fallback
  for (const event of list) {
    if (event.time <= t) {
      since = event.time
      current = event.value
    }
  }
  return { current, since, until: list.find(event => event.time > t)?.time ?? null }
}

export function isSupported(t: Date): boolean {
  return t.getTime() >= MIN_SUPPORTED_TIME && t.getTime() < MAX_SUPPORTED_TIME
}

export function nowSummary(t: Date): NowSummary {
  if (!isSupported(t)) {
    throw new RangeError(`time outside the supported range 1900-2100: ${String(t)}`)
  }
  const signEvents = searchAround(t, 4, (start, end) =>
    signIngresses(start, end).map(event => ({ time: event.time, value: event.sign })),
  )
  const mansionEvents = searchAround(t, 2, (start, end) =>
    mansionIngresses(start, end).map(event => ({ time: event.time, value: event.mansion })),
  )
  const phases = searchAround(t, 16, phaseEvents)
  const voids = voidsAround(t)
  const active = voids.find(period => period.start <= t && t < period.end) ?? null
  const nextVoid = voids.find(period => period.start > t)
  if (!nextVoid) throw new Error(`no void period found after ${t.toISOString()}`)
  const nextEvent = phases.find(event => event.time > t)!
  const { fraction, waxing } = illumination(t)
  const mercury = mercuryStateAt(t)
  return {
    phase: {
      current: { waxing, nextEvent, illumination: fraction },
      since: last(phases, event => event.time <= t)?.time ?? null,
      until: nextEvent.time,
    },
    sign: card(t, signEvents, signAt(t)),
    void: { active, next: nextVoid },
    mansion: card(t, mansionEvents, mansionAt(t)),
    mercury: { state: mercury.state, until: mercury.until, next: mercury.next },
  }
}

function voidsAround(t: Date): VoidPeriod[] {
  let days = 8
  for (;;) {
    const list = voidPeriods(new Date(t.getTime() - days * DAY_MS), new Date(t.getTime() + days * DAY_MS))
    if (list.some(period => period.start > t)) return list
    if (days >= MAX_WIDEN_DAYS) {
      throw new Error(`no void period starts within ${days} days after ${t.toISOString()}`)
    }
    days *= 2
  }
}

export function stepEvent(feature: Feature, t: Date, dir: 1 | -1): Date {
  switch (feature) {
    case 'sign':
      return stepState(t, dir, 4, (start, end) =>
        signIngresses(start, end).map(event => ({ time: event.time })),
      )
    case 'mansion':
      return stepState(t, dir, 2, (start, end) =>
        mansionIngresses(start, end).map(event => ({ time: event.time })),
      )
    case 'phase':
      return stepEvents(t, dir, 16, phaseEvents)
    case 'void':
      return stepVoid(t, dir)
    case 'mercury':
      return stepMercury(t, dir)
  }
}

function stepState(
  t: Date,
  dir: 1 | -1,
  initialDays: number,
  search: (start: Date, end: Date) => TimeEvent[],
): Date {
  let days = initialDays
  for (;;) {
    const list = search(new Date(t.getTime() - days * DAY_MS), new Date(t.getTime() + days * DAY_MS))
    if (dir === 1) {
      const after = list.find(event => event.time > t)
      if (after) return after.time
    } else {
      const current = last(list, event => event.time <= t)
      const previous = current ? last(list, event => event.time < current.time) : undefined
      if (previous) return previous.time
    }
    if (days >= MAX_WIDEN_DAYS) {
      throw new Error(`no ${dir === 1 ? 'next' : 'previous'} state boundary within ${days} days of ${t.toISOString()}`)
    }
    days *= 2
  }
}

function stepEvents(
  t: Date,
  dir: 1 | -1,
  initialDays: number,
  search: (start: Date, end: Date) => TimeEvent[],
): Date {
  let days = initialDays
  for (;;) {
    const list = search(new Date(t.getTime() - days * DAY_MS), new Date(t.getTime() + days * DAY_MS))
    const hit =
      dir === 1
        ? list.find(event => event.time > t)
        : last(list, event => event.time < t)
    if (hit) return hit.time
    if (days >= MAX_WIDEN_DAYS) {
      throw new Error(`no ${dir === 1 ? 'next' : 'previous'} event within ${days} days of ${t.toISOString()}`)
    }
    days *= 2
  }
}

function stepVoid(t: Date, dir: 1 | -1): Date {
  let days = 8
  for (;;) {
    const list = voidPeriods(
      new Date(t.getTime() - days * DAY_MS),
      new Date(t.getTime() + days * DAY_MS),
    )
    const active = list.find(period => period.start <= t && t < period.end)
    if (dir === 1) {
      if (active) return active.end
      const next = list.find(period => period.start > t)
      if (next) return next.start
    } else {
      if (active) {
        const index = list.indexOf(active)
        if (index > 0) return list[index - 1].end
      } else {
        const ended = last(list, period => period.end < t)
        if (ended) return ended.end
      }
    }
    if (days >= MAX_WIDEN_DAYS) {
      throw new Error(`no ${dir === 1 ? 'next' : 'previous'} void boundary within ${days} days of ${t.toISOString()}`)
    }
    days *= 2
  }
}

function stepMercury(t: Date, dir: 1 | -1): Date {
  let days = 200
  for (;;) {
    const boundaries = mercuryBoundaries(
      mercuryCycles(new Date(t.getTime() - days * DAY_MS), new Date(t.getTime() + days * DAY_MS)),
    )
    if (dir === 1) {
      const after = boundaries.find(boundary => boundary.time > t)
      if (after) return after.time
    } else {
      const current = last(boundaries, boundary => boundary.time <= t)
      if (current) {
        if (current.to === 'none' && current.time < t) return current.time
        const previous = last(boundaries, boundary => boundary.time < current.time)
        if (previous) return previous.time
      }
    }
    if (days >= MAX_WIDEN_DAYS) {
      throw new Error(`no ${dir === 1 ? 'next' : 'previous'} Mercury boundary within ${days} days of ${t.toISOString()}`)
    }
    days *= 2
  }
}
