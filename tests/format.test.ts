import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatMonth, formatTime } from '../src/format'

describe('formatDateTime', () => {
  it('renders a 12h date and time in the given zone', () => {
    expect(formatDateTime(new Date('2026-11-22T10:09:34Z'), 'America/New_York', '12h')).toBe(
      'Sun, Nov 22, 5:09\u00a0AM',
    )
  })

  it('renders a 24h date and time in the given zone', () => {
    expect(formatDateTime(new Date('2026-11-22T10:09:34Z'), 'America/New_York', '24h')).toBe(
      'Sun, Nov 22, 05:09',
    )
  })

  it('uses the zone date, not the UTC date', () => {
    expect(formatDateTime(new Date('2026-11-21T04:46:46Z'), 'America/New_York', '12h')).toBe(
      'Fri, Nov 20, 11:46\u00a0PM',
    )
  })
})

describe('formatTime', () => {
  it('renders 12h with an uppercase meridiem', () => {
    expect(formatTime(new Date('2026-11-21T04:46:46Z'), 'America/New_York', '12h')).toBe('11:46\u00a0PM')
  })

  it('renders 24h with a leading zero', () => {
    expect(formatTime(new Date('2026-11-22T07:38:28Z'), 'America/New_York', '24h')).toBe('02:38')
  })
})

describe('formatDate and formatMonth', () => {
  it('spell out a calendar date and month without shifting zones', () => {
    expect(formatDate({ y: 2026, m: 11, d: 22 })).toBe('Sun, Nov 22, 2026')
    expect(formatDate({ y: 1900, m: 1, d: 1 })).toBe('Mon, Jan 1, 1900')
    expect(formatMonth(2026, 11)).toBe('November 2026')
  })
})
