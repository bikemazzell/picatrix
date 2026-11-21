import { toLocal, type LocalDate } from './calendar/tz'

export type Clock = '12h' | '24h'

const NBSP = '\u00a0'

const formatters = new Map<string, Intl.DateTimeFormat>()

function cached(key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let fmt = formatters.get(key)
  if (!fmt) {
    fmt = make()
    formatters.set(key, fmt)
  }
  return fmt
}

export function formatTime(t: Date, tz: string, clock: Clock): string {
  return cached(
    `time|${tz}|${clock}`,
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: clock === '12h' ? 'h12' : 'h23',
      }),
  )
    .format(t)
    .replace(/\s/g, NBSP)
}

export function formatDay(t: Date, tz: string, refYear?: number): string {
  const withYear = refYear !== undefined && toLocal(t, tz).y !== refYear
  return cached(
    `day|${tz}|${withYear}`,
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: withYear ? 'numeric' : undefined,
      }),
  ).format(t)
}

export function formatDateTime(t: Date, tz: string, clock: Clock, refYear?: number): string {
  return `${formatDay(t, tz, refYear)}, ${formatTime(t, tz, clock)}`
}

export function formatDate(date: LocalDate): string {
  return cached(
    'date',
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
  ).format(new Date(Date.UTC(date.y, date.m - 1, date.d)))
}

export function formatMonth(y: number, m: number): string {
  return cached(
    'month',
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
      }),
  ).format(new Date(Date.UTC(y, m - 1, 1)))
}
