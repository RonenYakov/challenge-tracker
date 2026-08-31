import { describe, it, expect } from 'vitest'
import { goalProgress, expectedValueOn } from './goal-logic.js'
import type { Challenge, Goal, GoalEntry } from './types.js'

const TZ = 'Asia/Jerusalem'

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1', userId: 'u1', name: 'Test', startDate: '2026-09-01',
    lengthDays: 60, dayCutoffHour: 4, timezone: TZ, graceTokensTotal: 0,
    attemptNo: 1, status: 'active', createdAt: '', ...over,
  }
}

/** Lose 3kg: 80 down to 77 over 60 days. */
function losing(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', challengeId: 'c1', label: 'Lose 3kg', kind: 'number', unit: 'kg',
    startValue: 80, targetValue: 77, completedOn: null, archived: false, createdAt: '', ...over,
  }
}

/** Read 12 books: 0 up to 12. */
function gaining(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g2', challengeId: 'c1', label: 'Read 12 books', kind: 'number', unit: 'books',
    startValue: 0, targetValue: 12, completedOn: null, archived: false, createdAt: '', ...over,
  }
}

function entry(loggedOn: string, value: number): GoalEntry {
  return { id: 'e', goalId: 'g1', loggedOn, value, createdAt: '' }
}

describe('expectedValueOn', () => {
  const c = challenge({ startDate: '2026-09-01', lengthDays: 60 })

  it('expects the start value on day 1', () => {
    expect(expectedValueOn(losing(), c, '2026-09-01')).toBe(80)
  })

  it('expects the target value on the final day', () => {
    // day 60 of a 60 day challenge starting Sep 1 is Oct 30
    expect(expectedValueOn(losing(), c, '2026-10-30')).toBeCloseTo(77)
  })

  it('interpolates linearly in between', () => {
    // Day 30 of 60 is a little under halfway: (30-1)/(60-1)
    const halfway = expectedValueOn(losing(), c, '2026-09-30')
    expect(halfway).toBeCloseTo(80 - 3 * (29 / 59), 5)
  })

  it('works upward as well as downward', () => {
    expect(expectedValueOn(gaining(), c, '2026-09-01')).toBe(0)
    expect(expectedValueOn(gaining(), c, '2026-10-30')).toBeCloseTo(12)
  })

  it('does not run past the target after the final day', () => {
    expect(expectedValueOn(losing(), c, '2026-12-31')).toBe(77)
  })

  it('does not run below the start before day 1', () => {
    expect(expectedValueOn(losing(), c, '2026-08-01')).toBe(80)
  })

  it('handles a one day challenge without dividing by zero', () => {
    const oneDay = challenge({ startDate: '2026-09-01', lengthDays: 1 })
    expect(expectedValueOn(losing(), oneDay, '2026-09-01')).toBe(77)
  })
})

describe('goalProgress', () => {
  const c = challenge({ startDate: '2026-09-01', lengthDays: 60 })

  it('reports the start value when nothing has been logged', () => {
    const p = goalProgress(losing(), [], c, '2026-09-01')
    expect(p.current).toBe(80)
    expect(p.completion).toBe(0)
    expect(p.remaining).toBe(3)
    expect(p.direction).toBe('down')
  })

  it('uses the most recent reading, not the last one in the array', () => {
    const entries = [entry('2026-09-10', 79), entry('2026-09-03', 79.8)]
    expect(goalProgress(losing(), entries, c, '2026-09-11').current).toBe(79)
  })

  it('ignores readings logged after the date being asked about', () => {
    const entries = [entry('2026-09-03', 79.8), entry('2026-09-20', 78)]
    expect(goalProgress(losing(), entries, c, '2026-09-10').current).toBe(79.8)
  })

  it('is on pace when ahead of the line, going down', () => {
    // Day 30 expects about 78.5; being at 78 is ahead.
    const p = goalProgress(losing(), [entry('2026-09-30', 78)], c, '2026-09-30')
    expect(p.onPace).toBe(true)
  })

  it('is off pace when behind the line, going down', () => {
    const p = goalProgress(losing(), [entry('2026-09-30', 79.9)], c, '2026-09-30')
    expect(p.onPace).toBe(false)
  })

  it('is on pace when ahead of the line, going up', () => {
    // Day 30 of 12 books expects about 5.9
    const up = goalProgress(gaining(), [entry('2026-09-30', 7)], c, '2026-09-30')
    expect(up.onPace).toBe(true)
    expect(up.direction).toBe('up')
  })

  it('is off pace when behind the line, going up', () => {
    expect(goalProgress(gaining(), [entry('2026-09-30', 2)], c, '2026-09-30').onPace).toBe(false)
  })

  it('reports completion as the fraction of the distance covered', () => {
    // 80 -> 77 is 3 units. At 78.5, half the distance is covered.
    expect(goalProgress(losing(), [entry('2026-09-15', 78.5)], c, '2026-09-15').completion).toBeCloseTo(0.5)
  })

  it('clamps completion at 1 when the target is beaten', () => {
    const p = goalProgress(losing(), [entry('2026-09-15', 74)], c, '2026-09-15')
    expect(p.completion).toBe(1)
    expect(p.remaining).toBe(0)
  })

  it('clamps completion at 0 when moving the wrong way', () => {
    const p = goalProgress(losing(), [entry('2026-09-15', 82)], c, '2026-09-15')
    expect(p.completion).toBe(0)
    expect(p.remaining).toBe(5)
  })

  it('reports remaining as the distance still to move', () => {
    expect(goalProgress(losing(), [entry('2026-09-15', 78.5)], c, '2026-09-15').remaining).toBeCloseTo(1.5)
    expect(goalProgress(gaining(), [entry('2026-09-15', 5)], c, '2026-09-15').remaining).toBe(7)
  })

  it('treats a goal whose target equals its start as already complete', () => {
    const flat = losing({ startValue: 80, targetValue: 80 })
    const p = goalProgress(flat, [], c, '2026-09-15')
    expect(p.completion).toBe(1)
    expect(p.remaining).toBe(0)
    expect(p.onPace).toBe(true)
  })
})

describe('milestone goals', () => {
  const c = challenge({ startDate: '2026-09-01', lengthDays: 60 })

  function milestone(over: Partial<Goal> = {}): Goal {
    return {
      id: 'm1', challengeId: 'c1', label: 'Ship to production', kind: 'milestone',
      unit: null, startValue: null, targetValue: null, completedOn: null,
      archived: false, createdAt: '', ...over,
    }
  }

  it('is not complete until it is ticked', () => {
    const p = goalProgress(milestone(), [], c, '2026-09-15')
    expect(p.completion).toBe(0)
  })

  it('is complete once ticked', () => {
    const p = goalProgress(milestone({ completedOn: '2026-09-15' }), [], c, '2026-09-20')
    expect(p.completion).toBe(1)
  })

  it('does not show as complete before the day it was ticked', () => {
    // Looking back at an earlier date should not show a future completion.
    const p = goalProgress(milestone({ completedOn: '2026-09-20' }), [], c, '2026-09-15')
    expect(p.completion).toBe(0)
  })

  it('never reports being behind pace', () => {
    // There is no line to fall behind. Nagging about an undated outcome is noise.
    expect(goalProgress(milestone(), [], c, '2026-10-25').onPace).toBe(true)
  })

  it('reports no numbers at all', () => {
    const p = goalProgress(milestone(), [], c, '2026-09-15')
    expect(p.current).toBeNull()
    expect(p.expected).toBeNull()
    expect(p.remaining).toBeNull()
    expect(p.direction).toBeNull()
  })
})
