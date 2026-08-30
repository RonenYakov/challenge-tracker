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
  const fraction = elapsedFraction(challenge, date)
  return goal.startValue + (goal.targetValue - goal.startValue) * fraction
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
  const direction: GoalProgress['direction'] = goal.targetValue < goal.startValue ? 'down' : 'up'

  // The latest reading on or before `date`, so looking at a past day shows what was
  // known then rather than leaking a future weigh-in into it.
  const latest = entries
    .filter((e) => e.loggedOn <= date)
    .sort((a, b) => a.loggedOn.localeCompare(b.loggedOn))
    .at(-1)

  const current = latest?.value ?? goal.startValue
  const span = goal.targetValue - goal.startValue

  // A target equal to the start has no distance to cover, so it is done by definition.
  if (span === 0) {
    return { current, expected: goal.targetValue, completion: 1, onPace: true, remaining: 0, direction }
  }

  const expected = expectedValueOn(goal, challenge, date)
  const completion = clamp01((current - goal.startValue) / span)
  const remaining = Math.max(0, direction === 'down' ? current - goal.targetValue : goal.targetValue - current)
  const onPace = direction === 'down' ? current <= expected : current >= expected

  return { current, expected, completion, onPace, remaining, direction }
}
