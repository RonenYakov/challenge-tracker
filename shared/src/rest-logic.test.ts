import { describe, it, expect } from 'vitest'
import {
  activeDayNumber,
  activeDaysBefore,
  activeDaysElapsed,
  challengeEndDate,
  dateForActiveDay,
  firstActiveOnOrAfter,
  isRestDay,
  nextActiveDate,
  previousActiveDate,
} from './rest-logic.js'

// Reference week: Fri 2026-08-07, Sat 2026-08-08, Sun 2026-08-09, Mon 2026-08-10.
const SHABBAT = [6]
const NONE: number[] = []
const START = '2026-08-02' // a Sunday, so day 1 is active under [6]

describe('isRestDay', () => {
  it('is never true when nothing is set aside', () => {
    expect(isRestDay('2026-08-08', NONE)).toBe(false)
  })

  it('picks out Saturday and leaves Friday alone', () => {
    expect(isRestDay('2026-08-08', SHABBAT)).toBe(true)
    expect(isRestDay('2026-08-07', SHABBAT)).toBe(false)
  })

  it('handles a two day weekend', () => {
    expect(isRestDay('2026-08-09', [0, 6])).toBe(true)
    expect(isRestDay('2026-08-10', [0, 6])).toBe(false)
  })
})

describe('walking between active days', () => {
  it('steps over Shabbat going forward', () => {
    expect(nextActiveDate('2026-08-07', SHABBAT)).toBe('2026-08-09')
    expect(nextActiveDate('2026-08-07', NONE)).toBe('2026-08-08')
  })

  it('steps over Shabbat going back, so Sunday looks at Friday', () => {
    expect(previousActiveDate('2026-08-09', SHABBAT)).toBe('2026-08-07')
    expect(previousActiveDate('2026-08-09', NONE)).toBe('2026-08-08')
  })

  it('still advances when called on a rest day itself', () => {
    expect(nextActiveDate('2026-08-08', SHABBAT)).toBe('2026-08-09')
    expect(previousActiveDate('2026-08-08', SHABBAT)).toBe('2026-08-07')
  })

  it('round trips', () => {
    for (const date of ['2026-08-07', '2026-08-09', '2026-08-10', '2026-08-14']) {
      expect(previousActiveDate(nextActiveDate(date, SHABBAT), SHABBAT)).toBe(date)
    }
  })

  it('leaves an active date where it is, and moves a rest date forward', () => {
    expect(firstActiveOnOrAfter('2026-08-07', SHABBAT)).toBe('2026-08-07')
    expect(firstActiveOnOrAfter('2026-08-08', SHABBAT)).toBe('2026-08-09')
  })

  it('refuses to walk when every weekday is a rest day rather than spinning', () => {
    const all = [0, 1, 2, 3, 4, 5, 6]
    expect(() => nextActiveDate('2026-08-07', all)).toThrow(/no days in it/i)
    expect(() => previousActiveDate('2026-08-07', all)).toThrow(/no days in it/i)
    expect(() => dateForActiveDay(1, START, all)).toThrow(/no days in it/i)
  })
})

describe('counting active days', () => {
  it('is zero on the start date and never goes negative before it', () => {
    expect(activeDaysBefore(START, START, SHABBAT)).toBe(0)
    expect(activeDaysBefore('2026-07-01', START, SHABBAT)).toBe(0)
  })

  it('drops the Saturdays from a two week span', () => {
    // 2026-08-02 through 2026-08-15 is fourteen calendar days holding two Saturdays.
    expect(activeDaysBefore('2026-08-16', START, NONE)).toBe(14)
    expect(activeDaysBefore('2026-08-16', START, SHABBAT)).toBe(12)
  })

  it('stops early once the cap is reached', () => {
    expect(activeDaysBefore('2027-08-16', START, SHABBAT, 60)).toBe(60)
  })

  it('counts the day itself when it is active, and does not when it is not', () => {
    expect(activeDaysElapsed('2026-08-07', START, SHABBAT)).toBe(6)
    // Shabbat costs nothing: Saturday reads the same as the Friday before it.
    expect(activeDaysElapsed('2026-08-08', START, SHABBAT)).toBe(6)
    expect(activeDaysElapsed('2026-08-09', START, SHABBAT)).toBe(7)
  })

  it('gives day 1 to the start date and nothing to a rest day', () => {
    expect(activeDayNumber(START, START, SHABBAT)).toBe(1)
    expect(activeDayNumber('2026-08-08', START, SHABBAT)).toBe(null)
    expect(activeDayNumber('2026-07-30', START, SHABBAT)).toBe(null)
  })

  it('numbers the Monday of week two day seven, not day eight', () => {
    expect(activeDayNumber('2026-08-09', START, SHABBAT)).toBe(7)
    expect(activeDayNumber('2026-08-09', START, NONE)).toBe(8)
  })
})

describe('dateForActiveDay', () => {
  it('puts day one on the start date', () => {
    expect(dateForActiveDay(1, START, SHABBAT)).toBe(START)
  })

  it('is the inverse of activeDayNumber across a whole challenge', () => {
    for (let n = 1; n <= 60; n++) {
      const date = dateForActiveDay(n, START, SHABBAT)
      expect(isRestDay(date, SHABBAT)).toBe(false)
      expect(activeDayNumber(date, START, SHABBAT)).toBe(n)
    }
  })

  it('rejects a day number below one', () => {
    expect(() => dateForActiveDay(0, START, SHABBAT)).toThrow(/start at 1/i)
  })
})

describe('challengeEndDate', () => {
  it('runs the calendar on so sixty days is still sixty days of work', () => {
    const base = { startDate: START, lengthDays: 60 }
    expect(challengeEndDate({ ...base, restWeekdays: NONE })).toBe('2026-09-30')
    expect(challengeEndDate({ ...base, restWeekdays: SHABBAT })).toBe('2026-10-09')
  })
})

describe('daylight saving', () => {
  // Israel moves its clocks on 2026-10-25. Everything here routes through addDays,
  // which works in UTC, so the change must be invisible.
  it('does not shift a weekday across the change', () => {
    expect(isRestDay('2026-10-24', SHABBAT)).toBe(true)
    expect(isRestDay('2026-10-25', SHABBAT)).toBe(false)
  })

  it('does not shift the walkers', () => {
    expect(nextActiveDate('2026-10-23', SHABBAT)).toBe('2026-10-25')
    expect(previousActiveDate('2026-10-25', SHABBAT)).toBe('2026-10-23')
  })

  it('does not drop or double a day in the count', () => {
    expect(activeDaysBefore('2026-10-26', '2026-10-23', SHABBAT)).toBe(2)
  })
})
