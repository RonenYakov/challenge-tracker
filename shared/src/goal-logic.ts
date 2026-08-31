import { dayNumber } from './challenge-logic.js'
import type { Challenge, Goal, GoalEntry, GoalProgress, ISODate } from './types.js'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** How far through the challenge `date` is, 0 on day 1 and 1 on the final day. */
function elapsedFraction(challenge: Challenge, date: ISODate): number {
  // A one-day challenge has no span to interpolate across; it is simply due.
  if (challenge.lengthDays <= 1) return 1
  const day = dayNumber(date, challenge.startDate)
  return clamp01((day - 1) / (challenge.lengthDays - 1))
}

/**
 * Where a straight line from the starting reading to the target would put you on `date`.
 *
 * Real progress is rarely linear, especially weight. This is a reference line to compare
 * against, not a prediction, which is why nothing about it feeds the streak.
 */
export function expectedValueOn(goal: Goal, challenge: Challenge, date: ISODate): number {
  const start = goal.startValue ?? 0
  const target = goal.targetValue ?? 0
  const fraction = elapsedFraction(challenge, date)
  return start + (target - start) * fraction
}

/**
 * Current standing against the target, derived entirely from the logged readings.
 * Nothing here is stored, so editing or deleting a reading cannot leave a stale verdict.
 */
export function goalProgress(
  goal: Goal,
  entries: readonly GoalEntry[],
  challenge: Challenge,
  date: ISODate,
): GoalProgress {
  // A milestone is done or not done. It has no line to fall behind, so it never
  // reports being off pace: nagging about an outcome with no schedule is just noise.
  if (goal.kind === 'milestone') {
    const done = goal.completedOn !== null && goal.completedOn <= date
    return {
      current: null,
      expected: null,
      completion: done ? 1 : 0,
      onPace: true,
      remaining: null,
      direction: null,
    }
  }

  const startValue = goal.startValue ?? 0
  const targetValue = goal.targetValue ?? 0
  const direction: GoalProgress['direction'] = targetValue < startValue ? 'down' : 'up'

  // The latest reading on or before `date`, so looking at a past day shows what was
  // known then rather than leaking a future weigh-in into it.
  const latest = entries
    .filter((e) => e.loggedOn <= date)
    .sort((a, b) => a.loggedOn.localeCompare(b.loggedOn))
    .at(-1)

  const current = latest?.value ?? startValue
  const span = targetValue - startValue

  // A target equal to the start has no distance to cover, so it is done by definition.
  if (span === 0) {
    return { current, expected: targetValue, completion: 1, onPace: true, remaining: 0, direction }
  }

  const expected = expectedValueOn(goal, challenge, date)
  const completion = clamp01((current - startValue) / span)
  const remaining = Math.max(0, direction === 'down' ? current - targetValue : targetValue - current)
  const onPace = direction === 'down' ? current <= expected : current >= expected

  return { current, expected, completion, onPace, remaining, direction }
}
