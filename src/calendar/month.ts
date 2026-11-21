import { eventsFor, isSupportedYear, type EventBundle } from './cache'
import { mansionAt, signAt } from './day'
import { addDays, dayBounds, type LocalDate } from './tz'
import { elementOf, type MonthCell } from './types'

const MERGE_FRACTION = 0.005

export function monthGrid(y: number, m: number, tz: string): MonthCell[] {
  const first = firstCell(y, m)
  const bundle = eventsFor(dayBounds(first, tz).start, dayBounds(addDays(first, 41), tz).end)
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(first, i)
    cells.push(cellFor(date, date.m === m && date.y === y, tz, bundle))
  }
  return cells
}

function firstCell(y: number, m: number): LocalDate {
  const weekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  return addDays({ y, m, d: 1 }, -((weekday + 6) % 7))
}

function cellFor(
  date: LocalDate,
  inMonth: boolean,
  tz: string,
  bundle: EventBundle,
): MonthCell {
  const { start, end } = dayBounds(date, tz)
  if (!isSupportedYear(date.y)) {
    return {
      date,
      inMonth,
      inRange: false,
      mansions: [],
      phaseEvent: null,
      ingress: null,
      mercuryRetro: false,
      strip: [],
    }
  }
  const entered = bundle.mansions
    .filter(event => event.time > start && event.time < end)
    .map(event => event.mansion)
  return {
    date,
    inMonth,
    inRange: true,
    mansions: entered.length > 0 ? entered : [mansionAt(start)],
    phaseEvent: bundle.phases.find(event => event.time >= start && event.time < end) ?? null,
    ingress: bundle.signs.find(event => event.time > start && event.time < end) ?? null,
    mercuryRetro: bundle.mercury.some(
      cycle => (cycle.stationRetro <= start && start < cycle.stationDirect) ||
        (start <= cycle.stationRetro && cycle.stationRetro < end),
    ),
    strip: stripFor(start, end, bundle),
  }
}

function stripFor(start: Date, end: Date, bundle: EventBundle): MonthCell['strip'] {
  const spanMs = end.getTime() - start.getTime()
  const fraction = (t: Date) => (t.getTime() - start.getTime()) / spanMs
  const breaks = new Set<number>()
  for (const ingress of bundle.signs) {
    if (ingress.time > start && ingress.time < end) breaks.add(fraction(ingress.time))
  }
  for (const period of bundle.voids) {
    if (period.start > start && period.start < end) breaks.add(fraction(period.start))
    if (period.end > start && period.end < end) breaks.add(fraction(period.end))
  }
  const points = [0]
  for (const point of [...breaks].sort((a, b) => a - b)) {
    if (point - points[points.length - 1] >= MERGE_FRACTION) points.push(point)
  }
  if (1 - points[points.length - 1] >= MERGE_FRACTION) points.push(1)
  else points[points.length - 1] = 1
  const strip: MonthCell['strip'] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const mid = new Date(start.getTime() + ((points[i] + points[i + 1]) / 2) * spanMs)
    strip.push({
      from: points[i],
      to: points[i + 1],
      element: elementOf(signAt(mid)),
      void: bundle.voids.some(period => period.start <= mid && mid < period.end),
    })
  }
  return strip
}
