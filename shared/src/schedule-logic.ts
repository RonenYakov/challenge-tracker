import { addDays } from './challenge-logic.js'
import type { EventOccurrence, ISODate, ScheduledEvent } from './types.js'

/**
 * 0 = Sunday through 6 = Saturday.
 * Computed in UTC so a daylight-saving change can never shift which day it is.
 */
export function weekdayOf(date: ISODate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function occursOn(event: ScheduledEvent, date: ISODate): boolean {
  return event.weekdays.includes(weekdayOf(date))
}

/**
 * Every occurrence of every event between two dates, inclusive, ordered by date then
 * time of day. Expanding the rule into concrete dates here means the client never has
 * to reason about recurrence, and the same function feeds the Calendar export.
 */
export function occurrencesBetween(
  events: readonly ScheduledEvent[],
  from: ISODate,
  to: ISODate,
): EventOccurrence[] {
  if (from > to) return []

  const found: EventOccurrence[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const event of events) {
      if (occursOn(event, date)) found.push({ event, date })
    }
  }

  return found.sort(
    (a, b) => a.date.localeCompare(b.date) || a.event.timeOfDay.localeCompare(b.event.timeOfDay),
  )
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

/**
 * Length of a span given a start and end time, wrapping past midnight.
 *
 * A work shift from 17:30 to 01:00 is seven and a half hours, not minus sixteen. An
 * identical start and end means a full day rather than nothing, since a zero-length
 * event is never what anyone meant.
 */
export function minutesBetweenTimes(from: string, to: string): number {
  const diff = toMinutes(to) - toMinutes(from)
  if (diff > 0) return diff
  return diff + 24 * 60
}

/** The clock time a duration lands on, wrapping past midnight. */
export function endTimeOf(start: string, durationMinutes: number): string {
  const total = (toMinutes(start) + durationMinutes) % (24 * 60)
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** '7h 30m', '45m', '2h' — for showing a duration without making anyone count. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
