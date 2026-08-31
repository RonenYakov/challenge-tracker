import { describe, it, expect } from 'vitest'
import { weekdayOf, occursOn, occurrencesBetween } from './schedule-logic.js'
import type { ScheduledEvent } from './types.js'

function event(over: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return {
    id: 'e1',
    challengeId: 'c1',
    title: 'Gym',
    weekdays: [1, 3, 5], // Mon, Wed, Fri
    timeOfDay: '18:00',
    durationMinutes: 60,
    googleEventId: null,
    syncedAt: null,
    ...over,
  }
}

describe('weekdayOf', () => {
  it('reads the weekday from a date-only string', () => {
    // 2026-08-31 is a Monday.
    expect(weekdayOf('2026-08-31')).toBe(1)
    expect(weekdayOf('2026-09-06')).toBe(0) // Sunday
    expect(weekdayOf('2026-09-05')).toBe(6) // Saturday
  })

  it('is stable across a DST boundary', () => {
    // Computed in UTC, so a local clock change cannot shift the weekday.
    expect(weekdayOf('2026-10-25')).toBe(0)
    expect(weekdayOf('2026-10-26')).toBe(1)
  })
})

describe('occursOn', () => {
  it('matches the configured weekdays', () => {
    expect(occursOn(event(), '2026-08-31')).toBe(true)  // Monday
    expect(occursOn(event(), '2026-09-01')).toBe(false) // Tuesday
    expect(occursOn(event(), '2026-09-02')).toBe(true)  // Wednesday
  })

  it('handles an every-day event', () => {
    const daily = event({ weekdays: [0, 1, 2, 3, 4, 5, 6] })
    expect(occursOn(daily, '2026-09-01')).toBe(true)
    expect(occursOn(daily, '2026-09-06')).toBe(true)
  })

  it('handles a weekend-only event', () => {
    const weekend = event({ weekdays: [5, 6] }) // Fri, Sat, the Israeli weekend
    expect(occursOn(weekend, '2026-09-04')).toBe(true)  // Friday
    expect(occursOn(weekend, '2026-09-05')).toBe(true)  // Saturday
    expect(occursOn(weekend, '2026-09-06')).toBe(false) // Sunday
  })
})

describe('occurrencesBetween', () => {
  const gym = event()
  const call = event({ id: 'e2', title: 'Call mum', weekdays: [0], timeOfDay: '20:00' })

  it('lists every occurrence in the window, in date then time order', () => {
    // Mon 31 Aug through Sun 6 Sep
    const found = occurrencesBetween([gym, call], '2026-08-31', '2026-09-06')
    expect(found.map((o) => `${o.date} ${o.event.title}`)).toEqual([
      '2026-08-31 Gym',
      '2026-09-02 Gym',
      '2026-09-04 Gym',
      '2026-09-06 Call mum',
    ])
  })

  it('sorts same-day events by time', () => {
    const early = event({ id: 'a', title: 'Early', weekdays: [1], timeOfDay: '06:00' })
    const late = event({ id: 'b', title: 'Late', weekdays: [1], timeOfDay: '21:00' })
    const found = occurrencesBetween([late, early], '2026-08-31', '2026-08-31')
    expect(found.map((o) => o.event.title)).toEqual(['Early', 'Late'])
  })

  it('returns nothing when the window is empty or inverted', () => {
    expect(occurrencesBetween([gym], '2026-09-06', '2026-08-31')).toEqual([])
  })

  it('includes both endpoints', () => {
    const found = occurrencesBetween([gym], '2026-08-31', '2026-08-31')
    expect(found).toHaveLength(1)
  })

  it('does not run away on a very long window', () => {
    const found = occurrencesBetween([gym], '2026-01-01', '2026-12-31')
    // Three a week for a year, give or take the partial weeks at each end.
    expect(found.length).toBeGreaterThan(150)
    expect(found.length).toBeLessThan(160)
  })
})
