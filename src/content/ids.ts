import { VOID_PLANETS, type AspectAngle } from '../astro'
import { MANSION_NAMES, SIGN_NAMES } from './names'

export const ASPECT_ANGLES: readonly AspectAngle[] = [0, 60, 90, 120, 180]

export const SIGN_IDS: readonly string[] = SIGN_NAMES.map(name => `sign/${name.toLowerCase()}`)

export const PHASE_IDS: readonly string[] = [
  'phase/new',
  'phase/first-quarter',
  'phase/full',
  'phase/last-quarter',
  'phase/waxing',
  'phase/waning',
]

export const VOID_IDS: readonly string[] = [
  'void/general',
  ...ASPECT_ANGLES.flatMap(angle =>
    VOID_PLANETS.map(planet => `void/${angle}-${planet.toLowerCase()}`),
  ),
]

export const MANSION_IDS: readonly string[] = MANSION_NAMES.map(
  (_, i) => `mansion/${String(i + 1).padStart(2, '0')}`,
)

export const MERCURY_IDS: readonly string[] = [
  'mercury/approaching',
  'mercury/retrograde',
  'mercury/leaving',
  'mercury/none',
]

export function allContentIds(): string[] {
  return [...SIGN_IDS, ...PHASE_IDS, ...VOID_IDS, ...MANSION_IDS, ...MERCURY_IDS]
}
