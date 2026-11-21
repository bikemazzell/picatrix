import { describe, expect, it } from 'vitest'
import { formatDateTime, formatTime } from '../src/format'

describe('formatDateTime', () => {
  it('renders a 12h date and time in the given zone', () => {
    expect(formatDateTime(new Date('2026-11-22T10:09:34Z'), 'America/New_York', '12h')).toBe(
      '2026-11-22, 5:09 AM',
    )
  })

  it('renders a 24h date and time in the given zone', () => {
    expect(formatDateTime(new Date('2026-11-22T10:09:34Z'), 'America/New_York', '24h')).toBe(
      '2026-11-22, 05:09',
    )
  })

  it('uses the zone date, not the UTC date', () => {
    expect(formatDateTime(new Date('2026-11-21T04:46:46Z'), 'America/New_York', '12h')).toBe(
      '2026-11-20, 11:46 PM',
    )
  })
})

describe('formatTime', () => {
  it('renders 12h with an uppercase meridiem', () => {
    expect(formatTime(new Date('2026-11-21T04:46:46Z'), 'America/New_York', '12h')).toBe('11:46 PM')
  })

  it('renders 24h with a leading zero', () => {
    expect(formatTime(new Date('2026-11-22T07:38:28Z'), 'America/New_York', '24h')).toBe('02:38')
  })
})
