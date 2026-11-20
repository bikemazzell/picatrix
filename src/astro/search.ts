import { AstroTime, Search } from 'astronomy-engine'
import { norm180 } from './longitude'

// norm180 wraps at 180, so a step-to-step change of 180 degrees or more is a wrap
// artifact, not motion. Callers must keep steps small enough that true motion per
// step stays below this bound.
const JUMP_GUARD_DEGREES = 180
const TOLERANCE_SECONDS = 1
const DUPLICATE_MS = 2_000

export function findAngleCrossings(
  fn: (t: Date) => number,
  target: number,
  start: Date,
  end: Date,
  stepHours: number,
): Date[] {
  return findAngleCrossingsMulti(fn, [target], start, end, stepHours)[0]
}

export function findAngleCrossingsMulti(
  fn: (t: Date) => number,
  targets: readonly number[],
  start: Date,
  end: Date,
  stepHours: number,
): Date[][] {
  const startMs = start.getTime()
  const endMs = end.getTime()
  const stepMs = stepHours * 3_600_000
  const sampleMs: number[] = []
  if (startMs < endMs) {
    for (let i = 0; ; i++) {
      const t = startMs + i * stepMs
      if (t >= endMs) break
      sampleMs.push(t)
    }
    sampleMs.push(endMs)
  }
  const values = sampleMs.map(ms => fn(new Date(ms)))
  return targets.map(target => {
    const g = values.map(v => norm180(v - target))
    const roots: number[] = []
    for (let i = 0; i + 1 < sampleMs.length; i++) {
      const a = g[i]
      const b = g[i + 1]
      if (a === 0) {
        roots.push(sampleMs[i])
        continue
      }
      if (b === 0) {
        roots.push(sampleMs[i + 1])
        continue
      }
      if ((a < 0) === (b < 0)) continue
      if (Math.abs(a - b) >= JUMP_GUARD_DEGREES) continue
      roots.push(refine(fn, target, sampleMs[i], sampleMs[i + 1], a))
    }
    const kept: number[] = []
    for (const root of roots) {
      if (root < startMs || root >= endMs) continue
      if (kept.length > 0 && root - kept[kept.length - 1] < DUPLICATE_MS) continue
      kept.push(root)
    }
    return kept.map(ms => new Date(ms))
  })
}

function refine(
  fn: (t: Date) => number,
  target: number,
  ta: number,
  tb: number,
  ga: number,
): number {
  const direction = ga < 0 ? 1 : -1
  const g = (t: Date) => direction * norm180(fn(t) - target)
  let hit: AstroTime | null = null
  try {
    hit = Search(
      t => g(t.date),
      new AstroTime(new Date(ta)),
      new AstroTime(new Date(tb)),
      { dt_tolerance_seconds: TOLERANCE_SECONDS },
    )
  } catch {
    hit = null
  }
  return hit ? hit.date.getTime() : bisect(g, ta, tb)
}

function bisect(g: (t: Date) => number, ta: number, tb: number): number {
  let a = ta
  let b = tb
  let fa = g(new Date(a))
  for (let i = 0; i < 60 && b - a > 1; i++) {
    const m = Math.floor((a + b) / 2)
    const fm = g(new Date(m))
    if ((fa < 0) === (fm < 0)) {
      a = m
      fa = fm
    } else {
      b = m
    }
  }
  return Math.ceil((a + b) / 2)
}
