import { planetLongitude } from './longitude'
import { findAngleCrossings } from './search'
import type { MercuryCycle, MercuryState } from './types'

const DAY_MS = 86_400_000
const HALF_STEP_DAYS = 0.25
const STATION_STEP_HOURS = 12
const SHADOW_STEP_HOURS = 6
const SHADOW_WINDOW_DAYS = 30
const PAD_DAYS = 120
const STATE_HORIZON_DAYS = 400

function mercuryLongitude(t: Date): number {
  return planetLongitude('Mercury', t)
}

function mercurySpeed(t: Date): number {
  const offset = HALF_STEP_DAYS * DAY_MS
  let delta =
    mercuryLongitude(new Date(t.getTime() + offset)) - mercuryLongitude(new Date(t.getTime() - offset))
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return delta / (2 * HALF_STEP_DAYS)
}

interface Station {
  time: Date
  retro: boolean
}

function mercuryStations(start: Date, end: Date): Station[] {
  return findAngleCrossings(mercurySpeed, 0, start, end, STATION_STEP_HOURS).map(time => ({
    time,
    retro: mercurySpeed(new Date(time.getTime() + DAY_MS)) < 0,
  }))
}

function preShadowStart(stationRetro: Date, stationDirect: Date): Date {
  const target = mercuryLongitude(stationDirect)
  let days = SHADOW_WINDOW_DAYS
  for (;;) {
    const hits = findAngleCrossings(
      mercuryLongitude,
      target,
      new Date(stationRetro.getTime() - days * DAY_MS),
      stationRetro,
      SHADOW_STEP_HOURS,
    )
    if (hits.length > 0) return hits[hits.length - 1]
    days *= 2
  }
}

function postShadowEnd(stationDirect: Date, stationRetro: Date): Date {
  const target = mercuryLongitude(stationRetro)
  let days = SHADOW_WINDOW_DAYS
  for (;;) {
    const hits = findAngleCrossings(
      mercuryLongitude,
      target,
      stationDirect,
      new Date(stationDirect.getTime() + days * DAY_MS),
      SHADOW_STEP_HOURS,
    )
    if (hits.length > 0) return hits[0]
    days *= 2
  }
}

export function mercuryCycles(start: Date, end: Date): MercuryCycle[] {
  const stations = mercuryStations(
    new Date(start.getTime() - PAD_DAYS * DAY_MS),
    new Date(end.getTime() + PAD_DAYS * DAY_MS),
  )
  const out: MercuryCycle[] = []
  for (let i = 0; i + 1 < stations.length; i++) {
    const retro = stations[i]
    const direct = stations[i + 1]
    if (!retro.retro || direct.retro) continue
    const cycle: MercuryCycle = {
      preShadowStart: preShadowStart(retro.time, direct.time),
      stationRetro: retro.time,
      stationDirect: direct.time,
      postShadowEnd: postShadowEnd(direct.time, retro.time),
    }
    if (cycle.preShadowStart < end && start < cycle.postShadowEnd) out.push(cycle)
  }
  return out
}

export function mercuryStateAt(t: Date): { state: MercuryState; until: Date | null; next: Date } {
  const cycles = mercuryCycles(
    new Date(t.getTime() - STATE_HORIZON_DAYS * DAY_MS),
    new Date(t.getTime() + STATE_HORIZON_DAYS * DAY_MS),
  )
  const current = cycles.find(cycle => cycle.preShadowStart <= t && t < cycle.postShadowEnd)
  const upcoming = cycles.find(cycle => cycle.preShadowStart > t)
  if (!upcoming) {
    throw new Error(
      `no Mercury cycle begins within ${STATE_HORIZON_DAYS} days after ${t.toISOString()}`,
    )
  }
  if (!current) return { state: 'none', until: upcoming.preShadowStart, next: upcoming.preShadowStart }
  if (t < current.stationRetro) {
    return { state: 'approaching', until: current.stationRetro, next: upcoming.preShadowStart }
  }
  if (t < current.stationDirect) {
    return { state: 'retrograde', until: current.stationDirect, next: upcoming.preShadowStart }
  }
  return { state: 'leaving', until: current.postShadowEnd, next: upcoming.preShadowStart }
}
