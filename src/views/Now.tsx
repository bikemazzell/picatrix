import { useEffect, useMemo, useState } from 'preact/hooks'
import { nowSummary, stepEvent } from '../calendar/now'
import type { Feature, NowSummary } from '../calendar/types'
import { toLocal } from '../calendar/tz'
import { MANSION_NAMES, SIGN_NAMES } from '../content/names'
import type { VoidPeriod } from '../astro'
import { formatDateTime, formatTime, type Clock } from '../format'
import { effectiveTimeZone, useSettings } from '../settings'
import { AspectGlyph, MansionBadge, MoonGlyph, PlanetGlyph, SignGlyph } from './glyphs'
import { Sheet } from './Sheet'

const FEATURES: readonly Feature[] = ['phase', 'sign', 'void', 'mansion', 'mercury']

const HEADINGS: Record<Feature, string> = {
  phase: 'Phase',
  sign: 'Sign',
  void: 'Void',
  mansion: 'Mansion',
  mercury: 'Mercury',
}

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

function CardBody({
  summary,
  feature,
  tz,
  clock,
}: {
  summary: NowSummary
  feature: Feature
  tz: string
  clock: Clock
}) {
  switch (feature) {
    case 'phase':
      return (
        <>
          <MoonGlyph
            fraction={summary.phase.current.illumination}
            waxing={summary.phase.current.waxing}
          />
          <p class="card-title">
            {summary.phase.current.waxing ? 'Waxing' : 'Waning'}
          </p>
          {summary.phase.until && (
            <p>
              {`${QUARTER_NAMES[summary.phase.current.nextEvent.quarter]} ${formatDateTime(summary.phase.until, tz, clock)}`}
            </p>
          )}
        </>
      )
    case 'sign':
      return (
        <>
          <SignGlyph sign={summary.sign.current} />
          <p class="card-title">{SIGN_NAMES[summary.sign.current]}</p>
          {summary.sign.until && (
            <p>{`until ${formatDateTime(summary.sign.until, tz, clock)}`}</p>
          )}
        </>
      )
    case 'void': {
      const active = summary.void.active
      const period = active ?? summary.void.next
      return (
        <>
          <p class="card-title">{active ? 'Void now' : 'Later'}</p>
          <p>
            {period.lastAspect && <AspectGlyph angle={period.lastAspect.angle} />}
            {active
              ? `until ${formatDateTime(period.end, tz, clock)}`
              : voidLine(period, tz, clock)}
          </p>
        </>
      )
    }
    case 'mansion':
      return (
        <>
          <MansionBadge n={summary.mansion.current} />
          <p class="card-title">{MANSION_NAMES[summary.mansion.current - 1]}</p>
          {summary.mansion.until && (
            <p>{`until ${formatDateTime(summary.mansion.until, tz, clock)}`}</p>
          )}
        </>
      )
    case 'mercury':
      return (
        <>
          <PlanetGlyph planet="Mercury" />
          <p class="card-title">{summary.mercury.state}</p>
          {summary.mercury.until && (
            <p>{`until ${formatDateTime(summary.mercury.until, tz, clock)}`}</p>
          )}
        </>
      )
  }
}

function Card({
  feature,
  at,
  pinned,
  tz,
  clock,
  onStep,
  onOpen,
}: {
  feature: Feature
  at: Date
  pinned: boolean
  tz: string
  clock: Clock
  onStep: (feature: Feature, dir: 1 | -1) => void
  onOpen: (contentId: string) => void
}) {
  const summary = useMemo(() => summaryAt(at), [at])
  if (summary === null) {
    return (
      <article class="card" data-feature={feature}>
        <h2>{HEADINGS[feature]}</h2>
        <p>No data</p>
      </article>
    )
  }
  return (
    <article
      class="card"
      data-feature={feature}
      data-pinned={pinned ? 'true' : undefined}
      onClick={() => onOpen(contentId(summary, feature))}
    >
      <div class="card-head">
        <h2>{HEADINGS[feature]}</h2>
        <div class="card-steps">
          <button
            type="button"
            aria-label={`Previous ${feature}`}
            onClick={event => {
              event.stopPropagation()
              onStep(feature, -1)
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={`Next ${feature}`}
            onClick={event => {
              event.stopPropagation()
              onStep(feature, 1)
            }}
          >
            ›
          </button>
        </div>
      </div>
      <CardBody summary={summary} feature={feature} tz={tz} clock={clock} />
      {pinned && <p class="card-pinned">{`at ${formatDateTime(at, tz, clock)}`}</p>}
    </article>
  )
}

// stepEvent and nowSummary search from different windows, so the same boundary
// can differ by ~0.1s; land just inside the span the step targets, not on it.
const STEP_INSIDE_MS = 1_000

function steppedCursor(feature: Feature, from: Date, dir: 1 | -1): Date {
  const boundary = stepEvent(feature, from, dir)
  const inside = feature === 'void' && dir === -1 ? -STEP_INSIDE_MS : STEP_INSIDE_MS
  return new Date(boundary.getTime() + inside)
}

export function Now({ now: nowFn = () => new Date() }: { now?: () => Date }) {
  const [settings] = useSettings()
  const tz = effectiveTimeZone(settings)
  const clock = settings.clock
  const [base, setBase] = useState(() => nowFn())
  const [cursors, setCursors] = useState<Cursors>(liveCursors)
  const [sheetId, setSheetId] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setBase(nowFn())
    }, 60_000)
    return () => clearInterval(id)
  }, [nowFn])

  const onStep = (feature: Feature, dir: 1 | -1) => {
    setCursors(prev => ({ ...prev, [feature]: steppedCursor(feature, prev[feature] ?? base, dir) }))
  }

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
