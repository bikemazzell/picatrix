import { readdirSync, readFileSync } from 'node:fs'
import { afterAll, expect, test } from 'vitest'
import {
  mansionIngresses,
  moonAspects,
  phaseEvents,
  signIngresses,
  type Planet,
} from '../../src/astro'

declare const process: { env: Record<string, string | undefined> }

const FIXTURE_DIR = 'tests/fixtures/reference'
const DEFAULT_YEARS = [1950, 2000, 2026, 2050]
const PLANETS: readonly Planet[] = [
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
const CHECKED_KINDS = new Set(['phase', 'sign', 'mansion', 'aspect'])

interface Row {
  kind: string
  code: string
  unix: number
}

function fixtureYears(): number[] {
  return readdirSync(FIXTURE_DIR)
    .filter(name => /^\d{4}\.json$/.test(name))
    .map(name => Number(name.slice(0, 4)))
    .sort((a, b) => a - b)
}

function years(): number[] {
  if (process.env.REFERENCE_YEARS === 'all') return fixtureYears()
  return fixtureYears().filter(year => DEFAULT_YEARS.includes(year))
}

function toleranceFor(year: number): number {
  return year >= 1950 && year <= 2050 ? 60 : 300
}

function computedRows(start: Date, end: Date): Row[] {
  return [
    ...phaseEvents(start, end).map(event => ({
      kind: 'phase',
      code: String(event.quarter),
      unix: event.time.getTime() / 1000,
    })),
    ...signIngresses(start, end).map(event => ({
      kind: 'sign',
      code: String(event.sign),
      unix: event.time.getTime() / 1000,
    })),
    ...mansionIngresses(start, end).map(event => ({
      kind: 'mansion',
      code: String(event.mansion),
      unix: event.time.getTime() / 1000,
    })),
    ...moonAspects(start, end, PLANETS).map(event => ({
      kind: 'aspect',
      code: `${event.planet}-${event.angle}`,
      unix: event.time.getTime() / 1000,
    })),
  ]
}

interface Worst {
  seconds: number
  year: number
  code: string
}

const worst = new Map<string, Worst>()

function trackWorst(bucket: string, kind: string, code: string, year: number, seconds: number) {
  const key = `${bucket}:${kind}`
  const current = worst.get(key)
  if (!current || seconds > current.seconds) worst.set(key, { seconds, year, code })
}

afterAll(() => {
  const lines = [...worst.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, w]) => `${key}: ${w.seconds.toFixed(1)}s in ${w.year} (${w.code})`)
  console.log(['', 'max error per kind and bucket:', ...lines].join('\n'))
})

for (const year of years()) {
  test(
    `${year}: computed Moon events match the DE440 reference`,
    () => {
      const data = JSON.parse(readFileSync(`${FIXTURE_DIR}/${year}.json`, 'utf8'))
      const start = new Date(data.coverage.start)
      const end = new Date(data.coverage.end)
      const tol = toleranceFor(year)
      const bucket = year >= 1950 && year <= 2050 ? 'core' : 'outer'

      const expected = new Map<string, number[]>()
      for (const [kind, code, unix] of data.events as [string, string | number, number][]) {
        if (!CHECKED_KINDS.has(kind)) continue
        const key = `${kind}|${code}`
        const list = expected.get(key) ?? []
        list.push(unix)
        expected.set(key, list)
      }
      const computed = new Map<string, number[]>()
      for (const row of computedRows(start, end)) {
        const list = computed.get(`${row.kind}|${row.code}`) ?? []
        list.push(row.unix)
        computed.set(`${row.kind}|${row.code}`, list)
      }

      const violations: string[] = []
      const keys = new Set([...expected.keys(), ...computed.keys()])
      for (const key of keys) {
        const want = expected.get(key) ?? []
        const got = computed.get(key) ?? []
        const [kind, code] = key.split('|')
        if (want.length !== got.length) {
          violations.push(`${year} ${kind} ${code}: expected ${want.length} events, computed ${got.length}`)
          continue
        }
        want.sort((a, b) => a - b)
        got.sort((a, b) => a - b)
        for (let i = 0; i < want.length; i++) {
          const error = Math.abs(got[i] - want[i])
          trackWorst(bucket, kind, code, year, error)
          if (error > tol) {
            violations.push(`${year} ${kind} ${code}[${i}]: error ${error.toFixed(1)}s exceeds ${tol}s`)
          }
        }
      }
      expect(violations, violations.slice(0, 30).join('\n')).toEqual([])
    },
    300_000,
  )
}
