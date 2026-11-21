import { useEffect, useMemo } from 'preact/hooks'
import { monthGrid } from '../calendar/month'
import type { MonthCell } from '../calendar/types'
import { toLocal } from '../calendar/tz'
import { effectiveTimeZone, useSettings } from '../settings'
import { MansionBadge, MoonGlyph, PlanetGlyph, SignGlyph } from './glyphs'

const RANGE_MESSAGE =
  'No data for this month. The ephemeris covers 1900-01-01 through 2100-12-31.'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const QUARTER_MOON: Record<number, { fraction: number; waxing: boolean }> = {
  0: { fraction: 0, waxing: true },
  1: { fraction: 0.5, waxing: true },
  2: { fraction: 1, waxing: true },
  3: { fraction: 0.5, waxing: false },
}

export function parseMonth(s: string): { y: number; m: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(s)
  if (!match) return null
  const m = Number(match[2])
  if (m < 1 || m > 12) return null
  return { y: Number(match[1]), m }
}

function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`
}

function dayKey(date: { y: number; m: number; d: number }): string {
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
}

function shiftMonth(y: number, m: number, n: number): { y: number; m: number } {
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 }
}

const liveNow = () => new Date()

function Cell({
  cell,
  today,
  marks,
}: {
  cell: MonthCell
  today: boolean
  marks: { phase: boolean; sign: boolean; mercury: boolean }
}) {
  const classes = ['month-cell']
  if (!cell.inMonth) classes.push('out')
  if (today) classes.push('today')
  const moon = cell.phaseEvent ? QUARTER_MOON[cell.phaseEvent.quarter] : null
  return (
    <button
      type="button"
      class={classes.join(' ')}
      aria-label={dayKey(cell.date)}
      onClick={() => {
        location.hash = `#/day/${dayKey(cell.date)}`
      }}
    >
      <span class="cell-head">
        <span class="cell-day">{cell.date.d}</span>
        <MansionBadge n={cell.mansion} silent />
      </span>
      <span class="cell-marks">
        {marks.phase && moon !== null && <MoonGlyph fraction={moon.fraction} waxing={moon.waxing} />}
        {marks.sign && cell.ingress !== null && <SignGlyph sign={cell.ingress.sign} />}
        {marks.mercury && cell.mercuryRetro && <PlanetGlyph planet="Mercury" />}
      </span>
      <span class="month-strip" aria-hidden="true">
        {cell.strip.map((segment, i) => (
          <span
            key={i}
            class="month-seg"
            style={{
              width: `${((segment.to - segment.from) * 100).toFixed(3)}%`,
              background: `var(--${segment.void ? 'void' : segment.element})`,
            }}
          />
        ))}
      </span>
    </button>
  )
}

export function Month({ month, now: nowFn = liveNow }: { month: string; now?: () => Date }) {
  const [settings] = useSettings()
  const tz = effectiveTimeZone(settings)
  const parsed = parseMonth(month)
  const view = parsed ?? toLocal(nowFn(), tz)
  const viewKey = monthKey(view.y, view.m)

  useEffect(() => {
    if (parsed === null) location.hash = `#/month/${viewKey}`
  }, [parsed, viewKey])

  const cells = useMemo(() => {
    if (view.y < 1900 || view.y > 2100) return null
    return monthGrid(view.y, view.m, tz)
  }, [viewKey, tz])

  const today = dayKey(toLocal(nowFn(), tz))
  const marks = {
    phase: settings.features.phase,
    sign: settings.features.sign,
    mercury: settings.features.mercury,
  }

  const go = (n: number) => {
    const next = shiftMonth(view.y, view.m, n)
    location.hash = `#/month/${monthKey(next.y, next.m)}`
  }

  return (
    <div class="month-view">
      <header class="month-bar">
        <button type="button" aria-label="Previous month" onClick={() => go(-1)}>
          ‹
        </button>
        <h1 class="month-title">{viewKey}</h1>
        <button type="button" class="month-next" aria-label="Next month" onClick={() => go(1)}>
          ›
        </button>
      </header>
      {cells === null ? (
        <p class="month-empty">{RANGE_MESSAGE}</p>
      ) : (
        <>
          <div class="month-weekdays" aria-hidden="true">
            {WEEKDAYS.map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div class="month-grid">
            {cells.map(cell => (
              <Cell
                key={dayKey(cell.date)}
                cell={cell}
                today={dayKey(cell.date) === today}
                marks={marks}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
