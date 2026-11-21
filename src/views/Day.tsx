import { useEffect, useMemo, useState } from 'preact/hooks'
import type { VNode } from 'preact'
import { illumination, type MercuryState, type VoidPeriod } from '../astro'
import { daySummary } from '../calendar/day'
import type { DaySummary, Feature, Span } from '../calendar/types'
import { addDays, dayBounds, toLocal, type LocalDate } from '../calendar/tz'
import { MANSION_NAMES, SIGN_NAMES } from '../content/names'
import { formatDateTime, formatTime, type Clock } from '../format'
import { effectiveTimeZone, useSettings } from '../settings'
import { AspectGlyph, MansionBadge, MoonGlyph, PlanetGlyph, SignGlyph } from './glyphs'
import { Sheet } from './Sheet'
import { FEATURES, HEADINGS } from './features'

const QUARTER_NAMES: Record<number, string> = {
  0: 'New Moon',
  1: 'First Quarter',
  2: 'Full Moon',
  3: 'Last Quarter',
}

const QUARTER_IDS: Record<number, string> = {
  0: 'new',
  1: 'first-quarter',
  2: 'full',
  3: 'last-quarter',
}

const TRANSITION_TEXT: Record<MercuryState, string> = {
  approaching: 'enters shadow at',
  retrograde: 'turns retrograde at',
  leaving: 'turns direct at',
  none: 'leaves shadow at',
}

const RANGE_MESSAGE =
  'No data for this date. The ephemeris covers 1900-01-01 through 2100-12-31.'

export function parseLocalDate(s: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const roundTrip = new Date(Date.UTC(y, m - 1, d))
  if (
    roundTrip.getUTCFullYear() !== y ||
    roundTrip.getUTCMonth() !== m - 1 ||
    roundTrip.getUTCDate() !== d
  ) {
    return null
  }
  return { y, m, d }
}

function ymd(date: LocalDate): string {
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
}

function inRange(date: LocalDate): boolean {
  return date.y >= 1900 && date.y <= 2100
}

function boundary(t: Date, date: LocalDate, tz: string, clock: Clock): string {
  const local = toLocal(t, tz)
  if (local.y === date.y && local.m === date.m && local.d === date.d) {
    return formatTime(t, tz, clock)
  }
  return formatDateTime(t, tz, clock)
}

interface Row {
  id: string
  text: string
  sub?: string
  lead?: VNode
}

function spanText(label: string, span: Span<number>, date: LocalDate, tz: string, clock: Clock): string {
  const from = span.from
  const until = span.until
  if (from !== null && until !== null) {
    return `${label}, ${boundary(from, date, tz, clock)} – ${boundary(until, date, tz, clock)}`
  }
  if (until !== null) return `${label} until ${boundary(until, date, tz, clock)}`
  if (from !== null) return `${label} after ${boundary(from, date, tz, clock)}`
  return `${label} all day`
}

function voidRow(
  period: VoidPeriod,
  date: LocalDate,
  tz: string,
  clock: Clock,
): Row {
  const { start, end } = dayBounds(date, tz)
  const id = period.lastAspect
    ? `void/${period.lastAspect.angle}-${period.lastAspect.planet.toLowerCase()}`
    : 'void/general'
  const lead = period.lastAspect ? <AspectGlyph angle={period.lastAspect.angle} /> : undefined
  if (period.start < start && period.end > end) return { id, text: 'All day', lead }
  if (period.start < start) return { id, text: `Until ${boundary(period.end, date, tz, clock)}`, lead }
  if (period.end > end) return { id, text: `From ${boundary(period.start, date, tz, clock)}`, lead }
  return {
    id,
    text: `${boundary(period.start, date, tz, clock)} – ${boundary(period.end, date, tz, clock)}`,
    lead,
  }
}

function rowsFor(
  summary: DaySummary,
  feature: Feature,
  date: LocalDate,
  tz: string,
  clock: Clock,
): Row[] {
  switch (feature) {
    case 'phase': {
      const waxing = summary.phase.waxing
      const rows: Row[] = [
        {
          id: `phase/${waxing ? 'waxing' : 'waning'}`,
          text: `${waxing ? 'Waxing' : 'Waning'}${summary.phase.event ? ' at day start' : ' all day'}`,
          lead: (
            <MoonGlyph
              fraction={illumination(dayBounds(date, tz).start).fraction}
              waxing={waxing}
            />
          ),
        },
      ]
      if (summary.phase.event) {
        rows.push({
          id: `phase/${QUARTER_IDS[summary.phase.event.quarter]}`,
          text: `${QUARTER_NAMES[summary.phase.event.quarter]} at ${boundary(summary.phase.event.time, date, tz, clock)}`,
        })
      }
      return rows
    }
    case 'sign':
      return summary.signs.map(span => ({
        id: `sign/${SIGN_NAMES[span.value].toLowerCase()}`,
        text: spanText(SIGN_NAMES[span.value], span, date, tz, clock),
        lead: <SignGlyph sign={span.value} silent />,
      }))
    case 'void':
      return summary.voids.map(period => voidRow(period, date, tz, clock))
    case 'mansion':
      return summary.mansions.map(span => ({
        id: `mansion/${String(span.value).padStart(2, '0')}`,
        text: spanText(MANSION_NAMES[span.value - 1], span, date, tz, clock),
        lead: <MansionBadge n={span.value} silent />,
      }))
    case 'mercury': {
      const mercury = summary.mercury
      const rows: Row[] = [
        {
          id: `mercury/${mercury.state}`,
          text: mercury.state,
          lead: <PlanetGlyph planet="Mercury" />,
          sub:
            mercury.until === null
              ? undefined
              : mercury.state === 'none'
                ? `next cycle from ${boundary(mercury.until, date, tz, clock)}`
                : `until ${boundary(mercury.until, date, tz, clock)}`,
        },
      ]
      for (const transition of mercury.transitions) {
        rows.push({
          id: `mercury/${transition.to}`,
          text: `${TRANSITION_TEXT[transition.to]} ${boundary(transition.time, date, tz, clock)}`,
        })
      }
      return rows
    }
  }
}

function Section({
  feature,
  summary,
  date,
  tz,
  clock,
  onOpen,
}: {
  feature: Feature
  summary: DaySummary
  date: LocalDate
  tz: string
  clock: Clock
  onOpen: (contentId: string) => void
}) {
  return (
    <section class="day-section" data-feature={feature}>
      <h2>{HEADINGS[feature]}</h2>
      <ul class="day-rows">
        {rowsFor(summary, feature, date, tz, clock).map(row => (
          <li key={row.id}>
            <button type="button" class="day-row" onClick={() => onOpen(row.id)}>
              {row.lead}
              <span>{row.text}</span>
              {row.sub !== undefined && <span class="row-sub">{row.sub}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Day({ date }: { date: string }) {
  const [settings] = useSettings()
  const tz = effectiveTimeZone(settings)
  const clock = settings.clock
  const [sheetId, setSheetId] = useState<string | null>(null)
  const parsed = parseLocalDate(date)
  const view = parsed ?? toLocal(new Date(), tz)
  const viewKey = ymd(view)

  useEffect(() => {
    if (parsed === null) location.hash = `#/day/${viewKey}`
  }, [parsed, viewKey])

  const summary = useMemo(() => {
    if (!inRange(view)) return null
    try {
      return daySummary(view, tz)
    } catch (error) {
      if (error instanceof RangeError) return null
      throw error
    }
  }, [viewKey, tz])

  const go = (n: number) => {
    location.hash = `#/day/${ymd(addDays(view, n))}`
  }
  const onPick = (event: Event) => {
    const value = (event.currentTarget as HTMLInputElement).value
    if (value !== '') location.hash = `#/day/${value}`
  }

  return (
    <div class="day-view">
      <header class="day-bar">
        <button type="button" aria-label="Previous day" onClick={() => go(-1)}>
          ‹
        </button>
        <h1 class="day-date">{viewKey}</h1>
        <input
          type="date"
          aria-label="Go to date"
          value={viewKey}
          min="1900-01-01"
          max="2100-12-31"
          onChange={onPick}
        />
        <button type="button" aria-label="Next day" onClick={() => go(1)}>
          ›
        </button>
      </header>
      {summary === null ? (
        <p class="day-empty">{RANGE_MESSAGE}</p>
      ) : (
        <div class="day-sections">
          {FEATURES.filter(feature => settings.features[feature]).map(feature => (
            <Section
              key={feature}
              feature={feature}
              summary={summary}
              date={view}
              tz={tz}
              clock={clock}
              onOpen={setSheetId}
            />
          ))}
        </div>
      )}
      {sheetId !== null && <Sheet contentId={sheetId} onClose={() => setSheetId(null)} />}
    </div>
  )
}
