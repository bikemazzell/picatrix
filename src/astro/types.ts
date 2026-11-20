export type Planet =
  | 'Sun'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto'

export type AspectAngle = 0 | 60 | 90 | 120 | 180

export interface PhaseEvent {
  quarter: 0 | 1 | 2 | 3
  time: Date
}

export interface SignIngress {
  sign: number
  time: Date
}

export interface MansionIngress {
  mansion: number
  time: Date
}

export interface MoonAspect {
  planet: Planet
  angle: AspectAngle
  time: Date
}
