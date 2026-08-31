import { describe, it, expect } from 'vitest'
import { buildIcs } from './ics.js'
import type { ScheduledEvent } from './types.js'

function event(over: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return {
    id: 'abc-123', challengeId: 'c1', title: 'Gym', weekdays: [1, 3, 5],
    timeOfDay: '18:00', durationMinutes: 60, googleEventId: null, syncedAt: null, ...over,
  }
}

const base = {
  timezone: 'Asia/Jerusalem',
  from: '2026-08-31',
  until: '2026-10-29',
  calendarName: '75 Hard',
}

describe('buildIcs', () => {
  it('produces a well-formed calendar with CRLF line endings', () => {
    const ics = buildIcs({ ...base, events: [event()] })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.split('\r\n').length).toBeGreaterThan(10)
  })

  it('maps weekdays to iCalendar day names', () => {
    const ics = buildIcs({ ...base, events: [event({ weekdays: [0, 1, 3, 5, 6] })] })
    expect(ics).toContain('BYDAY=SU,MO,WE,FR,SA')
  })

  it('names the timezone instead of converting to UTC', () => {
    // Converting would pin the offset and shift the event by an hour after a DST change.
    const ics = buildIcs({ ...base, events: [event()] })
    expect(ics).toContain('DTSTART;TZID=Asia/Jerusalem:20260831T180000')
    expect(ics).not.toContain('DTSTART:20260831T150000Z')
  })

  it('computes the end time from the duration', () => {
    const ics = buildIcs({ ...base, events: [event({ timeOfDay: '18:00', durationMinutes: 90 })] })
    expect(ics).toContain('DTEND;TZID=Asia/Jerusalem:20260831T193000')
  })

  it('wraps an end time past midnight without producing hour 24', () => {
    const ics = buildIcs({ ...base, events: [event({ timeOfDay: '23:30', durationMinutes: 60 })] })
    expect(ics).toContain('T003000')
    expect(ics).not.toContain('T243000')
  })

  it('stops recurring at the end of the challenge', () => {
    const ics = buildIcs({ ...base, events: [event()] })
    expect(ics).toContain('UNTIL=20261029T235900Z')
  })

  it('escapes characters that would otherwise break the format', () => {
    // A title containing a semicolon, a comma and a backslash: all three are
    // structural in iCalendar and would otherwise split the line into nonsense.
    const ics = buildIcs({ ...base, events: [event({ title: 'Gym; lift, hard\\fast' })] })
    expect(ics).toContain('SUMMARY:Gym\\; lift\\, hard\\\\fast')
  })

  it('handles a Hebrew title without corrupting it', () => {
    const ics = buildIcs({ ...base, events: [event({ title: 'אימון בוקר' })] })
    expect(ics).toContain('אימון בוקר')
  })

  it('folds a long line without splitting a multi-byte character', () => {
    const long = 'אימון'.repeat(30)
    const ics = buildIcs({ ...base, events: [event({ title: long })] })
    // Every folded continuation starts with a single space, and nothing is mangled.
    expect(ics).not.toContain('\uFFFD')
    for (const line of ics.split('\r\n')) {
      expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75)
    }
  })

  it('emits an empty but valid calendar when there is nothing scheduled', () => {
    const ics = buildIcs({ ...base, events: [] })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
