import type { AspectAngle, Planet } from '../astro'
import { ASPECT_NAMES, PLANET_NAMES, SIGN_NAMES } from '../content/names'

const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

const PLANET_GLYPHS: Record<Planet, string> = {
  Sun: '☉',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
}

const ASPECT_GLYPHS: Record<AspectAngle, string> = {
  0: '☌',
  60: '⚹',
  90: '□',
  120: '△',
  180: '☍',
}

export function MoonGlyph({ fraction, waxing }: { fraction: number; waxing: boolean }) {
  const f = Math.min(1, Math.max(0, fraction))
  const rx = (Math.abs(1 - 2 * f) * 8).toFixed(2)
  const outer = waxing ? 1 : 0
  const crescent = f < 0.5
  const inner = waxing === crescent ? 0 : 1
  const percent = Math.round(f * 100)
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      role="img"
      aria-label={`${waxing ? 'Waxing' : 'Waning'} moon, ${percent}% illuminated`}
    >
      <circle class="moon-dark" cx="10" cy="10" r="8" />
      <path class="moon-lit" d={`M 10 2 A 8 8 0 0 ${outer} 10 18 A ${rx} 8 0 0 ${inner} 10 2 Z`} />
      <circle class="moon-rim" cx="10" cy="10" r="8" />
    </svg>
  )
}

export function SignGlyph({ sign, silent = false }: { sign: number; silent?: boolean }) {
  const index = ((sign % 12) + 12) % 12
  if (silent) return <span class="glyph" aria-hidden="true">{SIGN_GLYPHS[index]}</span>
  return (
    <span class="glyph" role="img" aria-label={SIGN_NAMES[index]}>
      {SIGN_GLYPHS[index]}
    </span>
  )
}

export function PlanetGlyph({ planet }: { planet: Planet }) {
  return (
    <span class="glyph" role="img" aria-label={PLANET_NAMES[planet]}>
      {PLANET_GLYPHS[planet]}
    </span>
  )
}

export function AspectGlyph({ angle }: { angle: AspectAngle }) {
  return (
    <span class="glyph" role="img" aria-label={ASPECT_NAMES[angle]}>
      {ASPECT_GLYPHS[angle]}
    </span>
  )
}

export function MansionBadge({ n, silent = false }: { n: number; silent?: boolean }) {
  if (silent) return <span class="mansion-badge">{n}</span>
  return (
    <span class="mansion-badge" role="img" aria-label={`Mansion ${n} of 28`}>
      {n}
    </span>
  )
}

export function Chevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg class="chevron" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <path d={dir === 1 ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'} />
    </svg>
  )
}

export function CalendarIcon() {
  return (
    <svg class="chevron" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  )
}
