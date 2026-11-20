import { illumination, moonLongitude, type MercuryCycle, type MercuryState } from '../astro'
import { eventsFor } from './cache'
import { dayBounds, type LocalDate } from './tz'
import type { DaySummary, Span } from './types'

const MANSION_WIDTH = 360 / 28

export function signAt(t: Date): number {
  return Math.floor(moonLongitude(t) / 30) % 12
}

export function mansionAt(t: Date): number {
  return Math.floor(moonLongitude(t) / MANSION_WIDTH) + 1
}

export interface MercuryBoundary {
  time: Date
  to: MercuryState
}

export function mercuryBoundaries(cycles: MercuryCycle[]): MercuryBoundary[] {
  return cycles
    .flatMap(cycle => [
      { time: cycle.preShadowStart, to: 'approaching' },
      { time: cycle.stationRetro, to: 'retrograde' },
      { time: cycle.stationDirect, to: 'leaving' },
      { time: cycle.postShadowEnd, to: 'none' },
    ] as const)
    .sort((a, b) => a.time.getTime() - b.time.getTime())
}

interface ValueAtTime {
  time: Date
  value: number
}

function valueInEffect(t: Date, sorted: ValueAtTime[], fallback: number): number {
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].time <= t) return sorted[i].value
  }
  return fallback
}

function spansFor(
  start: Date,
  end: Date,
  sorted: ValueAtTime[],
  fallback: number,
): Span<number>[] {
  if (sorted.length === 0) return []
  const inside = sorted.filter(event => event.time > start && event.time < end)
  if (inside.length === 0) {
    return [{ value: valueInEffect(start, sorted, fallback), from: null, until: null }]
  }
  const spans: Span<number>[] = [
    { value: valueInEffect(start, sorted, fallback), from: null, until: inside[0].time },
  ]
  inside.forEach((event, i) => {
    spans.push({
      value: event.value,
      from: event.time,
      until: i + 1 < inside.length ? inside[i + 1].time : null,
    })
  })
  return spans
}

export function daySummary(date: LocalDate, tz: string): DaySummary {
  const { start, end } = dayBounds(date, tz)
  const bundle = eventsFor(start, end)
  const signs = spansFor(
    start,
    end,
    bundle.signs.map(event => ({ time: event.time, value: event.sign })),
    signAt(start),
  )
  const mansions = spansFor(
    start,
    end,
    bundle.mansions.map(event => ({ time: event.time, value: event.mansion })),
    mansionAt(start),
  )
  const boundaries = mercuryBoundaries(bundle.mercury)
  let state: MercuryState = 'none'
  for (const boundary of boundaries) {
    if (boundary.time <= start) state = boundary.to
  }
  return {
    date,
    phase: {
      waxing: illumination(start).waxing,
      event: bundle.phases.find(event => event.time >= start && event.time < end) ?? null,
    },
    signs,
    voids: bundle.voids.filter(
      period => period.start < end && start < period.end,
    ),
    mansions,
    mercury: {
      state,
      until: boundaries.find(boundary => boundary.time > start)?.time ?? null,
      next:
        boundaries.find(boundary => boundary.to === 'approaching' && boundary.time > start)?.time ??
        end,
      transitions: boundaries
        .filter(boundary => boundary.time >= start && boundary.time < end)
        .map(boundary => ({ time: boundary.time, to: boundary.to })),
    },
  }
}
