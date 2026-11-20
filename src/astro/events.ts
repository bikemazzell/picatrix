import { Body, Illumination, MoonPhase } from 'astronomy-engine'
import { moonLongitude, norm360, planetLongitude } from './longitude'
import { findAngleCrossingsMulti } from './search'
import type { AspectAngle, MansionIngress, MoonAspect, PhaseEvent, Planet, SignIngress } from './types'

const MANSION_WIDTH = 360 / 28
const INGRESS_STEP_HOURS = 6
const ASPECT_STEP_HOURS = 3

const ASPECT_TARGETS: readonly { angle: AspectAngle; target: number }[] = [
  { angle: 0, target: 0 },
  { angle: 60, target: 60 },
  { angle: 60, target: 300 },
  { angle: 90, target: 90 },
  { angle: 90, target: 270 },
  { angle: 120, target: 120 },
  { angle: 120, target: 240 },
  { angle: 180, target: 180 },
]

export function phaseEvents(start: Date, end: Date): PhaseEvent[] {
  const elongation = (t: Date) => norm360(moonLongitude(t) - planetLongitude('Sun', t))
  const targets = [0, 90, 180, 270]
  const hits = findAngleCrossingsMulti(elongation, targets, start, end, INGRESS_STEP_HOURS)
  const out: PhaseEvent[] = []
  targets.forEach((_, quarter) => {
    for (const time of hits[quarter]) out.push({ quarter: quarter as PhaseEvent['quarter'], time })
  })
  return out.sort((a, b) => a.time.getTime() - b.time.getTime())
}

export function signIngresses(start: Date, end: Date): SignIngress[] {
  const targets = Array.from({ length: 12 }, (_, sign) => sign * 30)
  const hits = findAngleCrossingsMulti(moonLongitude, targets, start, end, INGRESS_STEP_HOURS)
  const out: SignIngress[] = []
  targets.forEach((_, sign) => {
    for (const time of hits[sign]) out.push({ sign, time })
  })
  return out.sort((a, b) => a.time.getTime() - b.time.getTime())
}

export function mansionIngresses(start: Date, end: Date): MansionIngress[] {
  const targets = Array.from({ length: 28 }, (_, k) => k * MANSION_WIDTH)
  const hits = findAngleCrossingsMulti(moonLongitude, targets, start, end, INGRESS_STEP_HOURS)
  const out: MansionIngress[] = []
  targets.forEach((_, k) => {
    for (const time of hits[k]) out.push({ mansion: k + 1, time })
  })
  return out.sort((a, b) => a.time.getTime() - b.time.getTime())
}

export function moonAspects(start: Date, end: Date, planets: readonly Planet[]): MoonAspect[] {
  const targets = ASPECT_TARGETS.map(aspect => aspect.target)
  const out: MoonAspect[] = []
  for (const planet of planets) {
    const separation = (t: Date) => norm360(moonLongitude(t) - planetLongitude(planet, t))
    const hits = findAngleCrossingsMulti(separation, targets, start, end, ASPECT_STEP_HOURS)
    ASPECT_TARGETS.forEach((aspect, i) => {
      for (const time of hits[i]) out.push({ planet, angle: aspect.angle, time })
    })
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime())
}

export function illumination(t: Date): { fraction: number; waxing: boolean } {
  return { fraction: Illumination(Body.Moon, t).phase_fraction, waxing: MoonPhase(t) < 180 }
}
