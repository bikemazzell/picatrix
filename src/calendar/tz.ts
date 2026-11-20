export interface LocalDate {
  y: number
  m: number
  d: number
}

export interface LocalTime extends LocalDate {
  h: number
  min: number
  weekday: number
}

const DAY_MS = 86_400_000
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

const wallFormatters = new Map<string, Intl.DateTimeFormat>()
const offsetFormatters = new Map<string, Intl.DateTimeFormat>()

function wallFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = wallFormatters.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    })
    wallFormatters.set(tz, fmt)
  }
  return fmt
}

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = offsetFormatters.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
      year: 'numeric',
    })
    offsetFormatters.set(tz, fmt)
  }
  return fmt
}

export function toLocal(t: Date, tz: string): LocalTime {
  const parts = wallFormatter(tz).formatToParts(t)
  const fields: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') fields[part.type] = part.value
  }
  const weekday = WEEKDAY_INDEX[fields.weekday]
  if (weekday === undefined) throw new Error(`unrecognized weekday: ${fields.weekday}`)
  return {
    y: Number(fields.year),
    m: Number(fields.month),
    d: Number(fields.day),
    h: Number(fields.hour),
    min: Number(fields.minute),
    weekday,
  }
}

function zoneOffsetMs(t: number, tz: string): number {
  const part = offsetFormatter(tz)
    .formatToParts(t)
    .find(p => p.type === 'timeZoneName')
  if (!part) throw new Error(`no timeZoneName part for ${tz}`)
  const text = part.value
  if (text === 'GMT') return 0
  const match = /^GMT([+-])(\d{1,2}):?(\d{2})?$/.exec(text)
  if (!match) throw new Error(`unrecognized offset: ${text}`)
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000
}

function naiveUtc(date: LocalDate, h: number, min: number): number {
  return Date.UTC(date.y, date.m - 1, date.d, h, min)
}

function isWallTime(t: number, date: LocalDate, h: number, min: number, tz: string): boolean {
  const wall = toLocal(new Date(t), tz)
  return wall.y === date.y && wall.m === date.m && wall.d === date.d && wall.h === h && wall.min === min
}

export function fromLocal(date: LocalDate, h: number, min: number, tz: string): Date {
  const naive = naiveUtc(date, h, min)
  const before = zoneOffsetMs(naive - DAY_MS, tz)
  const after = zoneOffsetMs(naive + DAY_MS, tz)
  const candidates =
    before === after ? [before] : [Math.max(before, after), Math.min(before, after)]
  const valid = candidates.map(offset => naive - offset).filter(t => isWallTime(t, date, h, min, tz))
  if (valid.length > 0) return new Date(Math.min(...valid))
  return new Date(naive - before)
}

export function dayBounds(date: LocalDate, tz: string): { start: Date; end: Date } {
  return { start: dayStart(date, tz), end: dayStart(addDays(date, 1), tz) }
}

function dayStart(date: LocalDate, tz: string): Date {
  const t = fromLocal(date, 0, 0, tz)
  if (isWallTime(t.getTime(), date, 0, 0, tz)) return t
  const naive = naiveUtc(date, 0, 0)
  const before = zoneOffsetMs(naive - DAY_MS, tz)
  const after = zoneOffsetMs(naive + DAY_MS, tz)
  if (before === after) {
    throw new Error(`midnight of ${date.y}-${date.m}-${date.d} is invalid in ${tz} but no clock change was found`)
  }
  let lo = naive - DAY_MS
  let hi = naive + DAY_MS
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (zoneOffsetMs(mid, tz) === before) lo = mid
    else hi = mid
  }
  return new Date(hi)
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
