import type { VNode } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { isSupported, nowSummary, stepEvent } from '../calendar/now'
import type { Feature, NowSummary } from '../calendar/types'
import { toLocal } from '../calendar/tz'
import { MANSION_NAMES, SIGN_NAMES } from '../content/names'
import type { VoidPeriod } from '../astro'
import { formatDateTime, formatTime, type Clock } from '../format'
import { effectiveClock, effectiveTimeZone, useSettings } from '../settings'
import { AspectGlyph, MansionBadge, MoonGlyph, PlanetGlyph, SignGlyph } from './glyphs'
import { Sheet } from './Sheet'
import { FEATURES, HEADINGS, MERCURY_LABELS } from './features'

const QUARTER_NAMES: Record<number, string> = {
  0: 'New',
  1: 'First Quarter',
  2: 'Full',
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

function voidLine(period: VoidPeriod, tz: string, clock: Clock): string {
  const from = toLocal(period.start, tz)
  const to = toLocal(period.end, tz)
  if (from.y === to.y && from.m === to.m && from.d === to.d) {
    return `from ${formatTime(period.start, tz, clock)} to ${formatTime(period.end, tz, clock)}`
  }
  return `from ${formatDateTime(period.start, tz, clock)} to ${formatDateTime(period.end, tz, clock)}`
}

interface CardContent {
  glyph: VNode | null
  title: string
  detail: string | null
}

function cardContent(summary: NowSummary, feature: Feature, tz: string, clock: Clock): CardContent {
  switch (feature) {
    case 'phase': {
      const { current } = summary.phase
      return {
        glyph: <MoonGlyph fraction={current.illumination} waxing={current.waxing} />,
        title: current.waxing ? 'Waxing' : 'Waning',
        detail:
          summary.phase.until &&
          `${QUARTER_NAMES[current.nextEvent.quarter]} ${formatDateTime(summary.phase.until, tz, clock)}`,
      }
    }
    case 'sign':
      return {
        glyph: <SignGlyph sign={summary.sign.current} silent />,
        title: SIGN_NAMES[summary.sign.current],
        detail: summary.sign.until && `until ${formatDateTime(summary.sign.until, tz, clock)}`,
      }
    case 'void': {
      const active = summary.void.active
      const period = active ?? summary.void.next
      return {
        glyph: period.lastAspect && <AspectGlyph angle={period.lastAspect.angle} />,
        title: active ? 'Void now' : 'Next void',
        detail: active ? `until ${formatDateTime(period.end, tz, clock)}` : voidLine(period, tz, clock),
      }
    }
    case 'mansion':
      return {
        glyph: <MansionBadge n={summary.mansion.current} />,
        title: MANSION_NAMES[summary.mansion.current - 1],
        detail: summary.mansion.until && `until ${formatDateTime(summary.mansion.until, tz, clock)}`,
      }
    case 'mercury':
      return {
        glyph: <PlanetGlyph planet="Mercury" />,
        title: MERCURY_LABELS[summary.mercury.state],
        detail: summary.mercury.until && `until ${formatDateTime(summary.mercury.until, tz, clock)}`,
      }
  }
}

function Card({
  feature,
  live,
  at,
  pinned,
  tz,
  clock,
  onStep,
  onOpen,
}: {
  feature: Feature
  live: NowSummary | null
  at: Date
  pinned: boolean
  tz: string
  clock: Clock
  onStep: (feature: Feature, dir: 1 | -1) => void
  onOpen: (contentId: string) => void
}) {
  const own = useMemo(() => (pinned ? summaryAt(at) : null), [pinned, at])
  const summary = pinned ? own : live
  const content = summary && cardContent(summary, feature, tz, clock)
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
        {pinned && <p class="card-pinned">{`at ${formatDateTime(at, tz, clock)}`}</p>}
      </div>
      <div class="card-steps">
        <button type="button" aria-label={`Previous ${feature}`} onClick={() => onStep(feature, -1)}>
          ‹
        </button>
        <button type="button" aria-label={`Next ${feature}`} onClick={() => onStep(feature, 1)}>
          ›
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

  const backToNow = () => {
    setBase(nowFn())
    setCursors(liveCursors())
  }

  return (
    <div class="now-view">
      <header class="now-bar">
        <p class="now-clock">{formatDateTime(base, tz, clock)}</p>
        <button type="button" onClick={backToNow}>
          Now
        </button>
      </header>
      <div class="cards">
        {FEATURES.filter(feature => settings.features[feature]).map(feature => (
          <Card
            key={feature}
            feature={feature}
            live={live}
            at={cursors[feature] ?? base}
            pinned={cursors[feature] !== null}
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
