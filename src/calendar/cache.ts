import {
  mansionIngresses,
  mercuryCycles,
  phaseEvents,
  signIngresses,
  voidPeriods,
  type MansionIngress,
  type MercuryCycle,
  type PhaseEvent,
  type SignIngress,
  type VoidPeriod,
} from '../astro'

const DAY_MS = 86_400_000
const PAD_DAYS = 3
const MERCURY_SEARCH_DAYS = 60

export const MIN_SUPPORTED_TIME = Date.UTC(1900, 0, 1)
export const MAX_SUPPORTED_TIME = Date.UTC(2101, 0, 1)
export function isSupportedYear(y: number): boolean {
  return y >= 1900 && y <= 2100
}

const MIN_COMPUTED_TIME = Date.UTC(1899, 11, 1)
const MAX_COMPUTED_TIME = Date.UTC(2101, 1, 1)

export interface EventBundle {
  covered: { start: Date; end: Date }
  phases: PhaseEvent[]
  signs: SignIngress[]
  mansions: MansionIngress[]
  voids: VoidPeriod[]
  mercury: MercuryCycle[]
}

const monthCache = new Map<string, EventBundle>()

function emptyBundle(start: number, end: number): EventBundle {
  return {
    covered: { start: new Date(start), end: new Date(end) },
    phases: [],
    signs: [],
    mansions: [],
    voids: [],
    mercury: [],
  }
}

function bundleForMonth(year: number, month: number): EventBundle {
  const key = `${year}-${month}`
  const cached = monthCache.get(key)
  if (cached) return cached
  const monthStart = Date.UTC(year, month, 1)
  const monthEnd = Date.UTC(year, month + 1, 1)
  let bundle: EventBundle
  if (monthEnd <= MIN_COMPUTED_TIME || monthStart >= MAX_COMPUTED_TIME) {
    bundle = emptyBundle(monthStart - PAD_DAYS * DAY_MS, monthEnd + PAD_DAYS * DAY_MS)
  } else {
    const start = monthStart - PAD_DAYS * DAY_MS
    const end = monthEnd + PAD_DAYS * DAY_MS
    bundle = {
      covered: { start: new Date(start), end: new Date(end) },
      phases: phaseEvents(new Date(start), new Date(end)),
      signs: signIngresses(new Date(start), new Date(end)),
      mansions: mansionIngresses(new Date(start), new Date(end)),
      voids: voidPeriods(new Date(start), new Date(end)),
      mercury: mercuryCycles(
        new Date(start - MERCURY_SEARCH_DAYS * DAY_MS),
        new Date(end + MERCURY_SEARCH_DAYS * DAY_MS),
      ),
    }
  }
  monthCache.set(key, bundle)
  return bundle
}

function dedupe<T>(lists: T[][], keyOf: (item: T) => number): T[] {
  const seen = new Set<number>()
  const out: T[] = []
  for (const item of lists.flat()) {
    const key = keyOf(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out.sort((a, b) => keyOf(a) - keyOf(b))
}

export function eventsFor(start: Date, end: Date): EventBundle {
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth()
  const bundles: EventBundle[] = []
  for (;;) {
    bundles.push(bundleForMonth(year, month))
    month += 1
    if (month === 12) {
      month = 0
      year += 1
    }
    if (Date.UTC(year, month, 1) >= end.getTime()) break
  }
  if (bundles.length === 1) return bundles[0]
  return {
    covered: {
      start: bundles[0].covered.start,
      end: bundles[bundles.length - 1].covered.end,
    },
    phases: dedupe(bundles.map(b => b.phases), event => event.time.getTime()),
    signs: dedupe(bundles.map(b => b.signs), event => event.time.getTime()),
    mansions: dedupe(bundles.map(b => b.mansions), event => event.time.getTime()),
    voids: dedupe(bundles.map(b => b.voids), period => period.start.getTime()),
    mercury: dedupe(bundles.map(b => b.mercury), cycle => cycle.stationRetro.getTime()),
  }
}
