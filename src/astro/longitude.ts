import { Body, Ecliptic, EclipticGeoMoon, GeoVector } from 'astronomy-engine'
import type { Planet } from './types'

const BODIES: Record<Planet, Body> = {
  Sun: Body.Sun,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
  Pluto: Body.Pluto,
}

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export function norm180(deg: number): number {
  const full = norm360(deg)
  return full > 180 ? full - 360 : full
}

export function moonLongitude(t: Date): number {
  return norm360(EclipticGeoMoon(t).lon)
}

export function planetLongitude(planet: Planet, t: Date): number {
  return norm360(Ecliptic(GeoVector(BODIES[planet], t, true)).elon)
}
