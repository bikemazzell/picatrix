import { moonAspects, signIngresses } from './events'
import type { MoonAspect, Planet, SignIngress, VoidPeriod } from './types'

export const VOID_PLANETS: readonly Planet[] = [
  'Sun',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
]

const DAY_MS = 86_400_000
const INGRESS_MARGIN_DAYS = 3

export function voidPeriods(
  start: Date,
  end: Date,
  planets: readonly Planet[] = VOID_PLANETS,
): VoidPeriod[] {
  const ingresses = bracketedIngresses(start, end)
  const out: VoidPeriod[] = []
  for (let i = 1; i < ingresses.length; i++) {
    const from = ingresses[i - 1]
    const to = ingresses[i]
    const aspects = moonAspects(from.time, to.time, planets)
    const lastAspect: MoonAspect | null = aspects.length > 0 ? aspects[aspects.length - 1] : null
    const period: VoidPeriod = {
      start: lastAspect ? lastAspect.time : from.time,
      end: to.time,
      sign: from.sign,
      lastAspect,
    }
    if (period.start < end && start < period.end) out.push(period)
  }
  return out
}

function bracketedIngresses(start: Date, end: Date): SignIngress[] {
  let marginDays = INGRESS_MARGIN_DAYS
  for (;;) {
    const events = signIngresses(
      new Date(start.getTime() - marginDays * DAY_MS),
      new Date(end.getTime() + marginDays * DAY_MS),
    )
    const before = events.some(event => event.time <= start)
    const after = events.some(event => event.time >= end)
    if (before && after) return events
    marginDays *= 2
  }
}
