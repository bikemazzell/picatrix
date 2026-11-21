import { toLocal } from './calendar/tz'

export type Clock = '12h' | '24h'

const timeFormatters = new Map<string, Intl.DateTimeFormat>()

function timeFormatter(tz: string, clock: Clock): Intl.DateTimeFormat {
  const key = `${tz}|${clock}`
  let fmt = timeFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hourCycle: clock === '12h' ? 'h12' : 'h23',
    })
    timeFormatters.set(key, fmt)
  }
  return fmt
}

export function formatTime(t: Date, tz: string, clock: Clock): string {
  return timeFormatter(tz, clock).format(t)
}

export function formatDateTime(t: Date, tz: string, clock: Clock): string {
  const { y, m, d } = toLocal(t, tz)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}, ${formatTime(t, tz, clock)}`
}
