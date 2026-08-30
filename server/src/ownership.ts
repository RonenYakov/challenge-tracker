import type { Challenge, Goal, Task } from '@ct/shared'
import { sql, toChallenge, toGoal, toTask } from './db.js'
import { notFound } from './errors.js'

/**
 * Every `:id` in the API passes through here before anything is read or written.
 *
 * A row the user does not own is reported as 404, not 403. A 403 would confirm the id
 * exists, which is a small information leak and an easy one to avoid.
 */

export async function loadOwnedChallenge(userId: string, challengeId: string): Promise<Challenge> {
  const [row] = await sql`
    select * from challenges
    where id = ${challengeId} and user_id = ${userId}
  `
  if (!row) throw notFound('Challenge')
  return toChallenge(row)
}

export async function loadOwnedTask(
  userId: string,
  taskId: string,
): Promise<{ task: Task; challenge: Challenge }> {
  const [row] = await sql`
    select t.*, row_to_json(c.*) as challenge
    from tasks t
    join challenges c on c.id = t.challenge_id
    where t.id = ${taskId} and c.user_id = ${userId}
  `
  if (!row) throw notFound('Task')
  return {
    task: toTask(row),
    challenge: toChallenge(row.challenge as Record<string, unknown>),
  }
}

/** The user's single active challenge, or null if they have none running. */
export async function loadActiveChallenge(userId: string): Promise<Challenge | null> {
  const [row] = await sql`
    select * from challenges
    where user_id = ${userId} and status = 'active'
  `
  return row ? toChallenge(row) : null
}

export async function loadOwnedGoal(
  userId: string,
  goalId: string,
): Promise<{ goal: Goal; challenge: Challenge }> {
  const [row] = await sql`
    select g.*, row_to_json(c.*) as challenge
    from goals g
    join challenges c on c.id = g.challenge_id
    where g.id = ${goalId} and c.user_id = ${userId}
  `
  if (!row) throw notFound('Goal')
  return {
    goal: toGoal(row),
    challenge: toChallenge(row.challenge as Record<string, unknown>),
  }
}
