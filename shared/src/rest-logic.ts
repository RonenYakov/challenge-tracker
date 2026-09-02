import { addDays, weekdayOf } from './challenge-logic.js'
import type { Challenge, ISODate } from './types.js'

/** 0 = Sunday through 6 = Saturday, matching `weekdayOf`. */
export type RestWeekdays = readonly number[]

/** How far any walker will step before giving up. A week is always enough with <= 6 rest days. */
const MAX_STEPS = 7

/**
 * Seven rest weekdays is a challenge with no days in it, and every walker below would
 * spin forever looking for a date that cannot exist. The database constraint and the
 * request schema both reject it; this is the last line of defence, so a hand-edited
 * row fails a request instead of hanging the thread serving it.
 */
function assertWalkable(rest: RestWeekdays): void {
  if (new Set(rest).size >= MAX_STEPS) {
    throw new Error('Every weekday is a rest day, so the challenge has no days in it.')
  }
}

export function isRestDay(date: ISODate, rest: RestWeekdays): boolean {
  return rest.includes(weekdayOf(date))
}

/** The first day with something due after `date`. Works whether or not `date` is itself a rest day. */
export function nextActiveDate(date: ISODate, rest: RestWeekdays): ISODate {
  assertWalkable(rest)
  let candidate = addDays(date, 1)
  for (let step = 0; step < MAX_STEPS; step++) {
    if (!isRestDay(candidate, rest)) return candidate
    candidate = addDays(candidate, 1)
  }
  throw new Error(`No active date found after ${date}.`)
}

/** The last day with something due before `date`. */
export function previousActiveDate(date: ISODate, rest: RestWeekdays): ISODate {
  assertWalkable(rest)
  let candidate = addDays(date, -1)
  for (let step = 0; step < MAX_STEPS; step++) {
    if (!isRestDay(candidate, rest)) return candidate
    candidate = addDays(candidate, -1)
  }
  throw new Error(`No active date found before ${date}.`)
}

/** `date` itself when something is due on it, otherwise the next day that qualifies. */
export function firstActiveOnOrAfter(date: ISODate, rest: RestWeekdays): ISODate {
  assertWalkable(rest)
  return isRestDay(date, rest) ? nextActiveDate(date, rest) : date
}

/**
 * Active days in `[startDate, date)`. Never negative: a date at or before the start
 * counts zero rather than reporting a run that has not begun.
 *
 * `max` stops the walk once that many have been counted. Every caller clamps to
 * `lengthDays` anyway, and without it a challenge left open for a year would walk
 * three hundred calendar days on every request.
 */
export function activeDaysBefore(
  date: ISODate,
  startDate: ISODate,
  rest: RestWeekdays,
  max = Number.POSITIVE_INFINITY,
): number {
  if (date <= startDate) return 0

  let count = 0
  for (let cursor = startDate; cursor < date; cursor = addDays(cursor, 1)) {
    if (isRestDay(cursor, rest)) continue
    count++
    if (count >= max) return max
  }
  return count
}

/**
 * How far into the challenge `date` is, counting the day itself when it is active.
 *
 * This is what every "day N of M" and "days remaining" caller wants, because it still
 * returns a number on a rest day, where `activeDayNumber` is deliberately null.
 */
export function activeDaysElapsed(
  date: ISODate,
  startDate: ISODate,
  rest: RestWeekdays,
  max = Number.POSITIVE_INFINITY,
): number {
  if (date < startDate) return 0
  const before = activeDaysBefore(date, startDate, rest, max)
  return Math.min(before + (isRestDay(date, rest) ? 0 : 1), max)
}

/** 1-based index among active days, or null when nothing is due on `date`. */
export function activeDayNumber(
  date: ISODate,
  startDate: ISODate,
  rest: RestWeekdays,
): number | null {
  if (date < startDate) return null
  if (isRestDay(date, rest)) return null
  return activeDaysBefore(date, startDate, rest) + 1
}

/** The inverse of `activeDayNumber`. Day 1 is `startDate` whenever the start is active. */
export function dateForActiveDay(n: number, startDate: ISODate, rest: RestWeekdays): ISODate {
  assertWalkable(rest)
  if (n < 1) throw new Error(`Active day numbers start at 1, got ${n}.`)

  let seen = 0
  let cursor = startDate
  // Every seven calendar days yield at least one active day, so this bound is generous.
  for (let step = 0; step <= n * MAX_STEPS + MAX_STEPS; step++) {
    if (!isRestDay(cursor, rest)) {
      seen++
      if (seen === n) return cursor
    }
    cursor = addDays(cursor, 1)
  }
  throw new Error(`No date found for active day ${n}.`)
}

/**
 * The calendar date of the final active day.
 *
 * `lengthDays` counts days of actual work, so a 60-day challenge with Saturdays off
 * runs about seventy calendar days. Anything that needs to know when the run ends has
 * to ask here rather than adding `lengthDays` to the start.
 */
export function challengeEndDate(
  challenge: Pick<Challenge, 'startDate' | 'lengthDays' | 'restWeekdays'>,
): ISODate {
  return dateForActiveDay(challenge.lengthDays, challenge.startDate, challenge.restWeekdays)
}
