import { describe, it, expect } from 'vitest'
import {
  resolveActiveDate,
  dayNumber,
  addDays,
  dayCompletion,
  findUnresolvedMiss,
  computeStreak,
  canBackfill,
  graceTokensRemaining,
  bestStreakEver,
} from './challenge-logic.js'
import type { Challenge, ChallengeEvent, DayLog, Task, TaskEntry } from './types.js'

const TZ = 'Asia/Jerusalem'

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    userId: 'u1',
    name: 'Test',
    startDate: '2026-08-01',
    lengthDays: 60,
    dayCutoffHour: 4,
    timezone: TZ,
    graceTokensTotal: 3,
    attemptNo: 1,
    status: 'active',
    createdAt: '2026-08-01T00:00:00Z',
    ...over,
  }
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    challengeId: 'c1',
    label: 'Task',
    kind: 'check',
    targetValue: null,
    unit: null,
    sortOrder: 0,
    isActive: true,
    ...over,
  }
}

function entry(taskId: string, value: number): TaskEntry {
  return { id: 'e-' + taskId, dayLogId: 'd1', taskId, value, timerStartedAt: null, updatedAt: '' }
}

function log(logDate: string, status: DayLog['status'], dayNo: number): DayLog {
  return {
    id: 'd-' + logDate,
    challengeId: 'c1',
    logDate,
    dayNumber: dayNo,
    attemptNo: 1,
    status,
    loggedLate: false,
    closedAt: null,
    note: null,
  }
}

describe('resolveActiveDate', () => {
  it('returns the same day during normal waking hours', () => {
    // 14:00 in Jerusalem on Aug 20 (UTC+3 in summer, so 11:00 UTC)
    expect(resolveActiveDate(new Date('2026-08-20T11:00:00Z'), 4, TZ)).toBe('2026-08-20')
  })

  it('still returns yesterday at 01:30 with a 4am cutoff', () => {
    // 01:30 Jerusalem on Aug 21 is 22:30 UTC on Aug 20
    expect(resolveActiveDate(new Date('2026-08-20T22:30:00Z'), 4, TZ)).toBe('2026-08-20')
  })

  it('rolls over exactly at the cutoff hour, not before', () => {
    // 03:59 Jerusalem Aug 21 is still Aug 20
    expect(resolveActiveDate(new Date('2026-08-21T00:59:00Z'), 4, TZ)).toBe('2026-08-20')
    // 04:00 Jerusalem Aug 21 is now Aug 21
    expect(resolveActiveDate(new Date('2026-08-21T01:00:00Z'), 4, TZ)).toBe('2026-08-21')
  })

  it('uses the challenge timezone, not the machine timezone', () => {
    // 21:00 UTC Aug 20 is 00:00 Aug 21 in Jerusalem.
    // With a midnight cutoff the two zones must disagree, which proves the zone is honoured.
    expect(resolveActiveDate(new Date('2026-08-20T21:00:00Z'), 0, TZ)).toBe('2026-08-21')
    expect(resolveActiveDate(new Date('2026-08-20T21:00:00Z'), 0, 'UTC')).toBe('2026-08-20')
  })

  it('treats a midnight cutoff as the plain local date', () => {
    expect(resolveActiveDate(new Date('2026-08-20T11:00:00Z'), 0, TZ)).toBe('2026-08-20')
  })

  it('resolves correctly on the day Israel leaves DST', () => {
    // Israel returns to UTC+2 in late October. 12:00 local must still be that same date.
    expect(resolveActiveDate(new Date('2026-10-25T10:00:00Z'), 4, TZ)).toBe('2026-10-25')
  })
})

describe('dayNumber and addDays', () => {
  it('counts the start date as day 1', () => {
    expect(dayNumber('2026-08-01', '2026-08-01')).toBe(1)
    expect(dayNumber('2026-08-02', '2026-08-01')).toBe(2)
    expect(dayNumber('2026-09-29', '2026-08-01')).toBe(60)
  })

  it('crosses a month boundary without drifting', () => {
    expect(dayNumber('2026-11-01', '2026-10-31')).toBe(2)
  })

  it('crosses a DST change without drifting', () => {
    expect(dayNumber('2026-10-26', '2026-10-24')).toBe(3)
  })

  it('goes negative-ish for dates before the start', () => {
    expect(dayNumber('2026-07-31', '2026-08-01')).toBe(0)
  })

  it('addDays is the inverse and handles leap years', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-08-20', 0)).toBe('2026-08-20')
  })
})

describe('dayCompletion', () => {
  const tasks = [
    task({ id: 'a', kind: 'check' }),
    task({ id: 'b', kind: 'count', targetValue: 3, unit: 'L' }),
    task({ id: 'c', kind: 'timer', targetValue: 45, unit: 'min' }),
  ]

  it('is 0 with no entries', () => {
    expect(dayCompletion([], tasks)).toBe(0)
  })

  it('counts a numeric task only once it reaches its target', () => {
    expect(dayCompletion([entry('b', 2.9)], tasks)).toBe(0)
    expect(dayCompletion([entry('b', 3)], tasks)).toBeCloseTo(1 / 3)
    expect(dayCompletion([entry('b', 4)], tasks)).toBeCloseTo(1 / 3)
  })

  it('is 1 when every active task hits its target', () => {
    expect(dayCompletion([entry('a', 1), entry('b', 3), entry('c', 60)], tasks)).toBe(1)
  })

  it('ignores retired tasks', () => {
    const withRetired = [...tasks, task({ id: 'd', isActive: false })]
    expect(dayCompletion([entry('a', 1), entry('b', 3), entry('c', 45)], withRetired)).toBe(1)
  })

  it('ignores entries for tasks that no longer exist', () => {
    expect(dayCompletion([entry('a', 1), entry('ghost', 99)], [task({ id: 'a' })])).toBe(1)
  })

  it('is 0 for a challenge with no tasks, never a free perfect day', () => {
    expect(dayCompletion([], [])).toBe(0)
  })
})

describe('findUnresolvedMiss', () => {
  const now = new Date('2026-08-05T11:00:00Z') // Aug 5, 14:00 Jerusalem
  const c = challenge({ startDate: '2026-08-01' })

  it('returns null when every closed day is complete', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 2),
      log('2026-08-03', 'complete', 3),
      log('2026-08-04', 'complete', 4),
      log('2026-08-05', 'pending', 5),
    ]
    expect(findUnresolvedMiss(logs, c, now)).toBeNull()
  })

  it('does not flag today just because it is still pending', () => {
    expect(
      findUnresolvedMiss([log('2026-08-05', 'pending', 1)], challenge({ startDate: '2026-08-05' }), now),
    ).toBeNull()
  })

  it('flags a closed day that was never logged at all', () => {
    expect(findUnresolvedMiss([log('2026-08-01', 'complete', 1)], c, now)).toEqual({
      date: '2026-08-02',
      dayNumber: 2,
    })
  })

  it('flags a closed day still sitting at pending', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'pending', 2),
      log('2026-08-03', 'complete', 3),
      log('2026-08-04', 'complete', 4),
    ]
    expect(findUnresolvedMiss(logs, c, now)).toEqual({ date: '2026-08-02', dayNumber: 2 })
  })

  it('treats a graced day as resolved', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'graced', 2),
      log('2026-08-03', 'complete', 3),
      log('2026-08-04', 'complete', 4),
    ]
    expect(findUnresolvedMiss(logs, c, now)).toBeNull()
  })

  it('returns the earliest miss when there are several', () => {
    const logs = [log('2026-08-01', 'incomplete', 1), log('2026-08-03', 'incomplete', 3)]
    expect(findUnresolvedMiss(logs, c, now)).toEqual({ date: '2026-08-01', dayNumber: 1 })
  })

  it('ignores days belonging to an earlier attempt', () => {
    const c2 = challenge({ startDate: '2026-08-04', attemptNo: 2 })
    const logs: DayLog[] = [
      { ...log('2026-08-01', 'incomplete', 1), attemptNo: 1 },
      { ...log('2026-08-04', 'complete', 1), attemptNo: 2 },
    ]
    expect(findUnresolvedMiss(logs, c2, now)).toBeNull()
  })

  it('does not look past the end of the challenge', () => {
    const short = challenge({ startDate: '2026-08-01', lengthDays: 2 })
    const logs = [log('2026-08-01', 'complete', 1), log('2026-08-02', 'complete', 2)]
    expect(findUnresolvedMiss(logs, short, now)).toBeNull()
  })

  it('does not flag anything before the challenge has started', () => {
    expect(findUnresolvedMiss([], challenge({ startDate: '2026-09-01' }), now)).toBeNull()
  })

  it('does not flag the previous day until the cutoff has actually passed', () => {
    // 01:00 Jerusalem on Aug 6 is still logically Aug 5, so Aug 5 is not closed yet.
    const lateNight = new Date('2026-08-05T22:00:00Z')
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 2),
      log('2026-08-03', 'complete', 3),
      log('2026-08-04', 'complete', 4),
      log('2026-08-05', 'pending', 5),
    ]
    expect(findUnresolvedMiss(logs, c, lateNight)).toBeNull()
  })
})

describe('computeStreak', () => {
  it('is zero with no logs', () => {
    expect(computeStreak([])).toEqual({ current: 0, best: 0 })
  })

  it('counts consecutive complete days', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 2),
      log('2026-08-03', 'complete', 3),
    ]
    expect(computeStreak(logs)).toEqual({ current: 3, best: 3 })
  })

  it('counts a graced day as unbroken', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'graced', 2),
      log('2026-08-03', 'complete', 3),
    ]
    expect(computeStreak(logs)).toEqual({ current: 3, best: 3 })
  })

  it('breaks on an incomplete day but remembers the best run', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 2),
      log('2026-08-03', 'complete', 3),
      log('2026-08-04', 'incomplete', 4),
      log('2026-08-05', 'complete', 5),
    ]
    expect(computeStreak(logs)).toEqual({ current: 1, best: 3 })
  })

  it('does not let a still-pending today reset the current streak', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 2),
      log('2026-08-03', 'pending', 3),
    ]
    expect(computeStreak(logs)).toEqual({ current: 2, best: 2 })
  })

  it('sorts by date rather than trusting input order', () => {
    const logs = [
      log('2026-08-03', 'complete', 3),
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 2),
    ]
    expect(computeStreak(logs)).toEqual({ current: 3, best: 3 })
  })

  it('treats a gap in the dates as a break, even with no incomplete row', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 2),
      log('2026-08-09', 'complete', 9),
    ]
    expect(computeStreak(logs)).toEqual({ current: 1, best: 2 })
  })
})

describe('canBackfill', () => {
  const now = new Date('2026-08-20T11:00:00Z') // Aug 20, 14:00 Jerusalem

  it('allows yesterday', () => {
    expect(canBackfill('2026-08-19', now, 4, TZ)).toBe(true)
  })

  it('rejects today, which is edited normally rather than backfilled', () => {
    expect(canBackfill('2026-08-20', now, 4, TZ)).toBe(false)
  })

  it('rejects two days ago', () => {
    expect(canBackfill('2026-08-18', now, 4, TZ)).toBe(false)
  })

  it('rejects the future', () => {
    expect(canBackfill('2026-08-21', now, 4, TZ)).toBe(false)
  })

  it('respects the cutoff at 01:00', () => {
    // 01:00 Aug 21 Jerusalem means the logical today is still Aug 20
    const lateNight = new Date('2026-08-20T22:00:00Z')
    expect(canBackfill('2026-08-19', lateNight, 4, TZ)).toBe(true)
    expect(canBackfill('2026-08-20', lateNight, 4, TZ)).toBe(false)
  })
})

describe('graceTokensRemaining', () => {
  const c = challenge({ graceTokensTotal: 3, attemptNo: 2 })
  const ev = (type: ChallengeEvent['type'], attemptNo: number): ChallengeEvent => ({
    id: 'x',
    challengeId: 'c1',
    type,
    dayNumber: 1,
    attemptNo,
    occurredAt: '',
  })

  it('starts at the configured total', () => {
    expect(graceTokensRemaining(c, [])).toBe(3)
  })

  it('subtracts tokens spent during the current attempt', () => {
    expect(graceTokensRemaining(c, [ev('grace_spent', 2), ev('grace_spent', 2)])).toBe(1)
  })

  it('gives a fresh set of tokens after a reset', () => {
    const spentOnAttemptOne = [ev('grace_spent', 1), ev('grace_spent', 1), ev('grace_spent', 1)]
    expect(graceTokensRemaining(c, spentOnAttemptOne)).toBe(3)
  })

  it('ignores reset events', () => {
    expect(graceTokensRemaining(c, [ev('reset', 2)])).toBe(3)
  })

  it('never goes negative', () => {
    const spent = [
      ev('grace_spent', 2),
      ev('grace_spent', 2),
      ev('grace_spent', 2),
      ev('grace_spent', 2),
    ]
    expect(graceTokensRemaining(c, spent)).toBe(0)
  })
})

describe('bestStreakEver', () => {
  const log = (
    logDate: string,
    status: DayLog['status'],
    attemptNo: number,
  ): DayLog => ({
    id: 'd-' + logDate + '-' + attemptNo,
    challengeId: 'c1',
    logDate,
    dayNumber: 1,
    attemptNo,
    status,
    loggedLate: false,
    closedAt: null,
    note: null,
  })

  it('is zero with no logs', () => {
    expect(bestStreakEver([])).toBe(0)
  })

  it('matches the best of a single attempt', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 1),
      log('2026-08-03', 'complete', 1),
    ]
    expect(bestStreakEver(logs)).toBe(3)
  })

  it('remembers a long run from an abandoned attempt', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 1),
      log('2026-08-03', 'complete', 1),
      log('2026-08-04', 'complete', 1),
      log('2026-08-05', 'incomplete', 1),
      // Reset. The new attempt is only two days old.
      log('2026-08-06', 'complete', 2),
      log('2026-08-07', 'complete', 2),
    ]
    expect(bestStreakEver(logs)).toBe(4)
  })

  it('does not let a run span a reset, even on consecutive dates', () => {
    const logs = [
      log('2026-08-01', 'complete', 1),
      log('2026-08-02', 'complete', 1),
      log('2026-08-03', 'complete', 2),
      log('2026-08-04', 'complete', 2),
    ]
    // Two runs of two, not one run of four.
    expect(bestStreakEver(logs)).toBe(2)
  })
})
