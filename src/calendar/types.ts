import type { MercuryState, PhaseEvent, SignIngress, VoidPeriod } from '../astro'
import type { LocalDate } from './tz'

export type Feature = 'phase' | 'sign' | 'void' | 'mansion' | 'mercury'

export type Element = 'fire' | 'earth' | 'air' | 'water'

const ELEMENTS: readonly Element[] = ['fire', 'earth', 'air', 'water']

export function elementOf(sign: number): Element {
  return ELEMENTS[((sign % 4) + 4) % 4]
}

export interface Span<T> {
  value: T
  from: Date | null
  until: Date | null
}

export interface DaySummary {
  date: LocalDate
  phase: { waxing: boolean; event: PhaseEvent | null }
  signs: Span<number>[]
  voids: VoidPeriod[]
  mansions: Span<number>[]
  mercury: {
    state: MercuryState
    until: Date | null
    next: Date
    transitions: { time: Date; to: MercuryState }[]
  }
}

export interface NowCard<T> {
  current: T
  since: Date | null
  until: Date | null
}

export interface NowSummary {
  phase: NowCard<{ waxing: boolean; nextEvent: PhaseEvent; illumination: number }>
  sign: NowCard<number>
  void: { active: VoidPeriod | null; next: VoidPeriod }
  mansion: NowCard<number>
  mercury: { state: MercuryState; until: Date | null; next: Date }
}

export interface MonthCell {
  date: LocalDate
  inMonth: boolean
  mansion: number
  phaseEvent: PhaseEvent | null
  ingress: SignIngress | null
  mercuryRetro: boolean
  strip: { from: number; to: number; element: Element; void: boolean }[]
}
