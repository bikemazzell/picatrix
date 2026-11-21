import type { VNode } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { isSupported, nowSummary, stepEvent } from '../calendar/now'
import type { Feature, NowSummary } from '../calendar/types'
import { toLocal } from '../calendar/tz'
import { MANSION_NAMES, SIGN_NAMES } from '../content/names'
import type { VoidPeriod } from '../astro'
import { formatDateTime, formatDay, formatTime, type Clock } from '../format'
import { effectiveClock, effectiveTimeZone, useSettings } from '../settings'
import { Chevron, AspectGlyph, MansionBadge, MoonGlyph, PlanetGlyph, SignGlyph } from './glyphs'
import { Sheet } from './Sheet'
import { FEATURES, HEADINGS, MERCURY_LABELS } from './features'

const QUARTER_NAMES: Record<number, string> = {
  0: 'New Moon',
  1: 'First Quarter',
  2: 'Full Moon',
  3: 'Last Quarter',
}

type Cursors = Record<Feature, Date | null>

function liveCursors(): Cursors {
  return { phase: null, sign: null, void: null, mansion: null, mercury: null }
}

function summaryAt(t: Date): NowSummary | null {
  try {
    return nowSummary(t)
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}

function contentId(summary: NowSummary, feature: Feature): string {
  switch (feature) {
    case 'phase':
      return `phase/${summary.phase.current.waxing ? 'waxing' : 'waning'}`
    case 'sign':
      return `sign/${SIGN_NAMES[summary.sign.current].toLowerCase()}`
    case 'void': {
      const aspect = (summary.void.active ?? summary.void.next).lastAspect
      return aspect ? `void/${aspect.angle}-${aspect.planet.toLowerCase()}` : 'void/general'
    }
    case 'mansion':
      return `mansion/${String(summary.mansion.current).padStart(2, '0')}`
    case 'mercury':
      return `mercury/${summary.mercury.state}`
  }
}

function voidLine(period: VoidPeriod, tz: string, clock: Clock, refYear: number): string {
  const from = toLocal(period.start, tz)
  const to = toLocal(period.end, tz)
  if (from.y === to.y && from.m === to.m && from.d === to.d) {
    const day = formatDay(period.start, tz, refYear)
    return `${day}, ${formatTime(period.start, tz, clock)}\u00a0– ${formatTime(period.end, tz, clock)}`
  }
  const start = formatDateTime(period.start, tz, clock, refYear)
  return `${start}\u00a0– ${formatDateTime(period.end, tz, clock, refYear)}`
}

interface CardContent {
  glyph: VNode | null
  title: string
  detail: string | null
}

function cardContent(
  summary: NowSummary,
  feature: Feature,
  tz: string,
  clock: Clock,
  refYear: number,
): CardContent {
  const at = (t: Date) => formatDateTime(t, tz, clock, refYear)
  switch (feature) {
    case 'phase': {
      const { current } = summary.phase
      return {
        glyph: <MoonGlyph fraction={current.illumination} waxing={current.waxing} />,
        title: current.waxing ? 'Waxing' : 'Waning',
        detail:
          summary.phase.until &&
          `${QUARTER_NAMES[current.nextEvent.quarter]}: ${at(summary.phase.until)}`,
      }
    }
    case 'sign':
      return {
        glyph: <SignGlyph sign={summary.sign.current} silent />,
        title: SIGN_NAMES[summary.sign.current],
        detail: summary.sign.until && `until ${at(summary.sign.until)}`,
      }
    case 'void': {
      const active = summary.void.active
      const period = active ?? summary.void.next
      return {
        glyph: period.lastAspect && <AspectGlyph angle={period.lastAspect.angle} />,
        title: active ? 'Void now' : 'Next void',
        detail: active ? `until ${at(period.end)}` : voidLine(period, tz, clock, refYear),
      }
    }
    case 'mansion':
      return {
        glyph: <MansionBadge n={summary.mansion.current} />,
        title: MANSION_NAMES[summary.mansion.current - 1],
        detail: summary.mansion.until && `until ${at(summary.mansion.until)}`,
      }
    case 'mercury':
      return {
        glyph: <PlanetGlyph planet="Mercury" />,
        title: MERCURY_LABELS[summary.mercury.state],
        detail: summary.mercury.until && `until ${at(summary.mercury.until)}`,
      }
  }
}

function Card({
  feature,
  live,
  at,
  pinned,
  baseYear,
  tz,
  clock,
  onStep,
  onOpen,
}: {
  feature: Feature
  live: NowSummary | null
  at: Date
  pinned: boolean
  baseYear: number
  tz: string
  clock: Clock
  onStep: (feature: Feature, dir: 1 | -1) => void
  onOpen: (contentId: string) => void
}) {
  const own = useMemo(() => (pinned ? summaryAt(at) : null), [pinned, at])
  const summary = pinned ? own : live
  const content = summary && cardContent(summary, feature, tz, clock, toLocal(at, tz).y)
  return (
    <article class="card" data-feature={feature}>
      {summary && (
        <button
          type="button"
          class="card-open"
          aria-label={`Open ${feature} details`}
          onClick={() => onOpen(contentId(summary, feature))}
        />
      )}
      <span class="card-glyph">{content?.glyph}</span>
      <div class="card-text">
        <h2>{HEADINGS[feature]}</h2>
        <p class="card-title">{content ? content.title : 'No data'}</p>
        {content?.detail && <p class="card-detail">{content.detail}</p>}
        {pinned && <p class="card-pinned">{`at ${formatDateTime(at, tz, clock, baseYear)}`}</p>}
      </div>
      <div class="card-steps">
        <button type="button" class="round" aria-label={`Previous ${feature}`} onClick={() => onStep(feature, -1)}>
          <Chevron dir={-1} />
        </button>
        <button type="button" class="round" aria-label={`Next ${feature}`} onClick={() => onStep(feature, 1)}>
          <Chevron dir={1} />
        </button>
      </div>
    </article>
  )
}

// stepEvent and nowSummary search from different windows, so the same boundary
// can differ by ~0.1s; land just inside the span the step targets, not on it.
const STEP_INSIDE_MS = 1_000

function steppedCursor(feature: Feature, from: Date, dir: 1 | -1): Date | null {
  const boundary = stepEvent(feature, from, dir)
  const inside = feature === 'void' && dir === -1 ? -STEP_INSIDE_MS : STEP_INSIDE_MS
  const next = new Date(boundary.getTime() + inside)
  return isSupported(next) ? next : null
}

const liveNow = () => new Date()

export function Now({ now: nowFn = liveNow }: { now?: () => Date }) {
  const [settings] = useSettings()
  const tz = effectiveTimeZone(settings)
  const clock = effectiveClock(settings)
  const [base, setBase] = useState(() => nowFn())
  const [cursors, setCursors] = useState<Cursors>(liveCursors)
  const [sheetId, setSheetId] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setBase(nowFn())
    }
    const id = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [nowFn])

  const onStep = (feature: Feature, dir: 1 | -1) => {
    setCursors(prev => {
      const next = steppedCursor(feature, prev[feature] ?? base, dir)
      return next === null ? prev : { ...prev, [feature]: next }
    })
  }

  const live = useMemo(() => summaryAt(base), [base])
  const stepped = Object.values(cursors).some(cursor => cursor !== null)

  const backToNow = () => {
    setBase(nowFn())
    setCursors(liveCursors())
  }

  return (
    <div class="now-view">
      <header class="view-bar">
        <h1>{formatDateTime(base, tz, clock)}</h1>
        {stepped && (
          <button type="button" class="pill" onClick={backToNow}>
            Back to now
          </button>
        )}
      </header>
      <div class="cards">
        {FEATURES.filter(feature => settings.features[feature]).map(feature => (
          <Card
            key={feature}
            feature={feature}
            live={live}
            at={cursors[feature] ?? base}
            pinned={cursors[feature] !== null}
            baseYear={toLocal(base, tz).y}
            tz={tz}
            clock={clock}
            onStep={onStep}
            onOpen={setSheetId}
          />
        ))}
      </div>
      {sheetId !== null && <Sheet contentId={sheetId} onClose={() => setSheetId(null)} />}
    </div>
  )
}
