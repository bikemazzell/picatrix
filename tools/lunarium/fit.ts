import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { voidPeriods, type Planet } from '../../src/astro'

const TOLERANCE_MS = 120_000
const DIR = 'local/lunarium'
const WINDOW_PAD_MS = 120_000

const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

export interface FitPeriod {
  start: number
  end: number
  planet: Planet | null
  angle: number | null
  sign: number
}

export interface Mismatch {
  year: number
  side: 'reference' | 'generated'
  start: number
  end: number
  detail: string
}

export interface YearFit {
  year: number
  windowStart: number
  windowEnd: number
  reference: number
  generated: number
  matched: number
}

export interface FitResult {
  planets: readonly Planet[]
  years: YearFit[]
  matched: number
  reference: number
  generated: number
  rate: number
  misses: Mismatch[]
}

function iso(t: number): string {
  return new Date(t).toISOString().replace('.000Z', 'Z')
}

function tableYears(): number[] {
  if (!existsSync(DIR)) return []
  return readdirSync(DIR)
    .map(name => /^(\d{4})\.json$/.exec(name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => Number(m[1]))
    .sort((a, b) => a - b)
}

function loadReference(year: number): FitPeriod[] {
  const rows = JSON.parse(readFileSync(`${DIR}/${year}.json`, 'utf8')) as {
    start: string
    end: string
  }[]
  return rows.map(row => ({
    start: Date.parse(row.start),
    end: Date.parse(row.end),
    planet: null,
    angle: null,
    sign: -1,
  }))
}

function generate(year: number, windowStart: number, windowEnd: number, planets: readonly Planet[]): FitPeriod[] {
  return voidPeriods(new Date(windowStart), new Date(windowEnd), planets)
    .filter(p => p.start.getTime() >= windowStart && p.end.getTime() <= windowEnd)
    .map(p => ({
      start: p.start.getTime(),
      end: p.end.getTime(),
      planet: p.lastAspect?.planet ?? null,
      angle: p.lastAspect?.angle ?? null,
      sign: p.sign,
    }))
}

function nearestGenerated(period: FitPeriod, generated: FitPeriod[]): FitPeriod | null {
  let best: FitPeriod | null = null
  let bestDelta = Infinity
  for (const gen of generated) {
    const delta = Math.abs(gen.start - period.start)
    if (delta < bestDelta) {
      bestDelta = delta
      best = gen
    }
  }
  return best
}

function fitYear(year: number, planets: readonly Planet[]): { fit: YearFit; misses: Mismatch[] } {
  const reference = loadReference(year)
  const tableStart = Math.min(...reference.map(r => r.start))
  const tableEnd = Math.max(...reference.map(r => r.end))
  const windowStart = Math.max(Date.UTC(year, 0, 1), tableStart - WINDOW_PAD_MS)
  const windowEnd = Math.min(Date.UTC(year + 1, 0, 1), tableEnd + WINDOW_PAD_MS)
  const ref = reference.filter(r => r.start >= windowStart && r.end <= windowEnd)
  const gen = generate(year, windowStart, windowEnd, planets)
  ref.sort((a, b) => a.start - b.start)
  gen.sort((a, b) => a.start - b.start)

  const misses: Mismatch[] = []
  let matched = 0
  let i = 0
  let j = 0
  while (i < gen.length && j < ref.length) {
    const delta = gen[i].start - ref[j].start
    if (Math.abs(delta) <= TOLERANCE_MS) {
      const endDelta = gen[i].end - ref[j].end
      if (Math.abs(endDelta) <= TOLERANCE_MS) {
        matched++
      } else {
        misses.push({
          year,
          side: 'reference',
          start: ref[j].start,
          end: ref[j].end,
          detail: `starts agree (${delta / 1000}s) but ends differ by ${endDelta / 1000}s: table ${iso(ref[j].end)} vs generated ${iso(gen[i].end)}`,
        })
      }
      i++
      j++
    } else if (delta < 0) {
      misses.push(...unmatchedGenerated(year, gen[i]))
      i++
    } else {
      misses.push(unmatchedReference(year, ref[j], gen))
      j++
    }
  }
  for (; i < gen.length; i++) misses.push(...unmatchedGenerated(year, gen[i]))
  for (; j < ref.length; j++) misses.push(unmatchedReference(year, ref[j], gen))

  return {
    fit: { year, windowStart, windowEnd, reference: ref.length, generated: gen.length, matched },
    misses,
  }
}

function unmatchedReference(year: number, period: FitPeriod, generated: FitPeriod[]): Mismatch {
  const nearest = nearestGenerated(period, generated)
  const delta = nearest ? (nearest.start - period.start) / 1000 : Infinity
  return {
    year,
    side: 'reference',
    start: period.start,
    end: period.end,
    detail: nearest
      ? `table void with no generated counterpart; nearest generated start ${delta}s away`
      : 'table void with no generated counterpart; no generated period in that year window',
  }
}

function unmatchedGenerated(year: number, period: FitPeriod): Mismatch[] {
  const aspect = period.planet
    ? `last aspect ${period.angle}deg ${period.planet} at ${iso(period.start)}`
    : `no aspect in ${SIGNS[period.sign]}, void from ingress at ${iso(period.start)}`
  return [
    {
      year,
      side: 'generated',
      start: period.start,
      end: period.end,
      detail: `generated void not in the table (${aspect}, ends at ingress to ${SIGNS[(period.sign + 1) % 12]} at ${iso(period.end)})`,
    },
  ]
}

export function runFit(planets: readonly Planet[]): FitResult {
  const years = tableYears()
  if (years.length === 0) throw new Error(`no ${DIR}/*.json tables; run tools/lunarium/fetch.ts`)
  const results = years.map(year => fitYear(year, planets))
  const matched = results.reduce((sum, r) => sum + r.fit.matched, 0)
  const reference = results.reduce((sum, r) => sum + r.fit.reference, 0)
  const generated = results.reduce((sum, r) => sum + r.fit.generated, 0)
  return {
    planets,
    years: results.map(r => r.fit),
    matched,
    reference,
    generated,
    rate: matched / reference,
    misses: results.flatMap(r => r.misses),
  }
}

const CANDIDATES: { name: string; planets: readonly Planet[] }[] = [
  {
    name: 'Sun..Saturn',
    planets: ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
  },
  {
    name: 'Sun..Saturn+Uranus',
    planets: ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus'],
  },
  {
    name: 'Sun..Saturn+Uranus+Neptune',
    planets: ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
  },
  {
    name: 'all nine (through Pluto)',
    planets: ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
  },
]

declare const process: { argv: string[] }

if (process.argv[1]?.replaceAll('\\', '/').endsWith('tools/lunarium/fit.ts')) {
  for (const candidate of CANDIDATES) {
    const fit = runFit(candidate.planets)
    console.log(`\n=== ${candidate.name} (${candidate.planets.length} planets) ===`)
    for (const year of fit.years) {
      console.log(
        `${year.year}: matched ${year.matched} of ${year.reference} reference (${year.generated} generated)`,
      )
    }
    console.log(
      `TOTAL: matched ${fit.matched}, unmatched reference ${fit.reference - fit.matched}, unmatched generated ${fit.generated - fit.matched}, rate ${(fit.rate * 100).toFixed(2)}%`,
    )
    for (const miss of fit.misses) {
      console.log(`  ${miss.year} ${miss.side} ${iso(miss.start)}..${iso(miss.end)}: ${miss.detail}`)
    }
  }
}
