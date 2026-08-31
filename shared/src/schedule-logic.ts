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
