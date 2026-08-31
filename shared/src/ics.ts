import type { ISODate, ScheduledEvent } from './types.js'

/** 0 = Sunday, in the order iCalendar names them. */
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/**
 * RFC 5545 says lines are folded at 75 octets. Long Hebrew titles blow past that in
 * bytes long before they do in characters, so folding counts bytes, not length.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 74) return line

  const parts: string[] = []
  let start = 0
  while (start < bytes.length) {
    let end = Math.min(start + (parts.length === 0 ? 74 : 73), bytes.length)
    // Never split a multi-byte character: back off to a boundary.
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--
    parts.push(bytes.subarray(start, end).toString('utf8'))
    start = end
  }
  return parts.join('\r\n ')
}

/** Escapes the characters iCalendar treats as structural. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (h! * 60 + m! + minutes) % (24 * 60)
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}${mm}00`
}

/**
 * A subscribable calendar of the challenge's weekly events.
 *
 * Times are emitted with a TZID rather than converted to UTC. Converting would pin the
 * event to a fixed offset, so a gym session at 18:00 would silently become 17:00 the
 * week the clocks change. Naming the zone lets the calendar client apply the real rules.
 */
export function buildIcs(options: {
  events: readonly ScheduledEvent[]
  timezone: string
  from: ISODate
  until: ISODate
  calendarName: string
}): string {
  const { events, timezone, from, until, calendarName } = options
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Challenge Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${escapeText(calendarName)}`),
    `X-WR-TIMEZONE:${timezone}`,
    // Ask subscribers to poll hourly. Most honour it loosely at best.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  const untilStamp = `${until.replace(/-/g, '')}T235900Z`

  for (const event of events) {
    const days = event.weekdays.map((d) => ICS_DAYS[d]).join(',')
    const startTime = `${event.timeOfDay.replace(':', '')}00`

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@challenge-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${timezone}:${from.replace(/-/g, '')}T${startTime}`,
      `DTEND;TZID=${timezone}:${from.replace(/-/g, '')}T${addMinutes(event.timeOfDay, event.durationMinutes)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days};UNTIL=${untilStamp}`,
      fold(`SUMMARY:${escapeText(event.title)}`),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
