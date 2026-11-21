import type { MercuryState } from '../astro'
import type { Feature } from '../calendar/types'

export const FEATURES: readonly Feature[] = ['phase', 'sign', 'void', 'mansion', 'mercury']

export const HEADINGS: Record<Feature, string> = {
  phase: 'Phase',
  sign: 'Sign',
  void: 'Void',
  mansion: 'Mansion',
  mercury: 'Mercury',
}

export const MERCURY_LABELS: Record<MercuryState, string> = {
  approaching: 'Pre-shadow',
  retrograde: 'Retrograde',
  leaving: 'Post-shadow',
  none: 'Direct',
}
