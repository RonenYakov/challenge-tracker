import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { activeDaysElapsed, goalProgress } from '@ct/shared'
import { sql, toGoal, toGoalEntry } from '../db.js'
import { loadOwnedChallenge, loadOwnedGoal } from '../ownership.js'
import { badRequest } from '../errors.js'
import { activeDateFor } from '../days.js'

const idParam = z.object({ id: z.string().uuid() })

/**
 * Two shapes of outcome. A numeric goal moves from a start to a target and is tracked
 * by readings; a milestone is done or not done. Forcing "ship to production" into a
 * start/target pair would be arithmetic pretending to be progress.
 */
const numberGoal = z.object({
  kind: z.literal('number'),
  label: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(20).nullable().default(null),
  startValue: z.number().finite(),
  targetValue: z.number().finite(),
})

const milestoneGoal = z.object({
  kind: z.literal('milestone'),
  label: z.string().trim().min(1).max(200),
})

const goalFields = z.discriminatedUnion('kind', [numberGoal, milestoneGoal])

export async function goalRoutes(app: FastifyInstance) {
  /** Every goal on a challenge, each with its readings and current standing. */
  app.get('/api/challenges/:id/goals', async (request) => {
    const { id } = idParam.parse(request.params)
    const challenge = await loadOwnedChallenge(request.user.id, id)
    const today = activeDateFor(challenge)

    const goalRows = await sql`
      select * from goals
      where challenge_id = ${id} and archived = false
      order by created_at asc
    `
    const goals = goalRows.map(toGoal)
    if (goals.length === 0) return { goals: [] }

    const entryRows = await sql`
      select * from goal_entries
      where goal_id in ${sql(goals.map((g) => g.id))}
      order by logged_on asc
    `
    const entries = entryRows.map(toGoalEntry)

    return {
      goals: goals.map((goal) => {
        const own = entries.filter((e) => e.goalId === goal.id)
        return {
          goal,
          entries: own,
          progress: goalProgress(goal, own, challenge, today),
          // Active days, not calendar days, and via the shared helper rather than the
          // arithmetic that used to be open-coded here and would have kept counting
          // rest days against the deadline.
          daysRemaining: Math.max(
            0,
            challenge.lengthDays -
              activeDaysElapsed(
                today,
                challenge.startDate,
                challenge.restWeekdays,
                challenge.lengthDays,
              ),
          ),
        }
      }),
    }
  })

  app.post('/api/challenges/:id/goals', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const body = goalFields.parse(request.body)
    await loadOwnedChallenge(request.user.id, id)

    // A target identical to the start has nothing to track and would render as
    // permanently complete, which is confusing rather than useful.
    if (body.kind === 'number' && body.startValue === body.targetValue) {
      throw badRequest('היעד חייב להיות שונה מערך ההתחלה.')
    }

    const [row] = await sql`
      insert into goals ${sql(
        body.kind === 'number'
          ? {
              challenge_id: id,
              kind: 'number',
              label: body.label,
              unit: body.unit,
              start_value: body.startValue,
              target_value: body.targetValue,
            }
          : { challenge_id: id, kind: 'milestone', label: body.label },
      )}
      returning *
    `
    reply.code(201)
    return { goal: toGoal(row!) }
  })

  app.patch('/api/goals/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    const body = z.object({ label: z.string().trim().min(1).max(200) }).parse(request.body)
    await loadOwnedGoal(request.user.id, id)

    // Only the label is editable. Moving a target mid-challenge would rewrite what
    // "on pace" meant for every reading already logged against it.
    const [row] = await sql`update goals set label = ${body.label} where id = ${id} returning *`
    return { goal: toGoal(row!) }
  })

  /** Ticking a milestone, and unticking it if it was premature. */
  app.post('/api/goals/:id/complete', async (request) => {
    const { id } = idParam.parse(request.params)
    const { done } = z.object({ done: z.boolean() }).parse(request.body)
    const { goal, challenge } = await loadOwnedGoal(request.user.id, id)

    if (goal.kind !== 'milestone') {
      throw badRequest('יעד מספרי נסגר לפי המדידות שלו, לא בסימון ידני.')
    }

    const [row] = await sql`
      update goals set completed_on = ${done ? activeDateFor(challenge) : null}
      where id = ${id} returning *
    `
    return { goal: toGoal(row!) }
  })

  /**
   * Archives rather than deletes, so the readings logged against it survive. A goal
   * that quietly vanished along with three weeks of weigh-ins would be worse.
   */
  app.delete('/api/goals/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    await loadOwnedGoal(request.user.id, id)
    await sql`update goals set archived = true where id = ${id}`
    reply.code(204)
    return null
  })

  /** Log a reading. One per day; logging again the same day replaces it. */
  app.put('/api/goals/:id/entries', async (request) => {
    const { id } = idParam.parse(request.params)
    const body = z
      .object({
        value: z.number().finite(),
        loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(request.body)

    const { goal, challenge } = await loadOwnedGoal(request.user.id, id)
    if (goal.kind !== 'number') {
      throw badRequest('היעד הזה הוא בוצע או לא בוצע, אין מה לתעד בו.')
    }

    const today = activeDateFor(challenge)
    const loggedOn = body.loggedOn ?? today

    // Unlike a daily task, a goal reading is not a streak claim, so backdating within
    // the challenge is allowed. The future is not.
    if (loggedOn > today) throw badRequest('אי אפשר לתעד מדידה לתאריך עתידי.')
    if (loggedOn < challenge.startDate) {
      throw badRequest('התאריך הזה מוקדם מתחילת האתגר.')
    }

    await sql`
      insert into goal_entries (goal_id, logged_on, value)
      values (${id}, ${loggedOn}, ${body.value})
      on conflict (goal_id, logged_on) do update set value = excluded.value
    `

    const entryRows = await sql`
      select * from goal_entries where goal_id = ${id} order by logged_on asc
    `
    const entries = entryRows.map(toGoalEntry)
    return { goal, entries, progress: goalProgress(goal, entries, challenge, today) }
  })

  app.delete('/api/goals/:id/entries/:date', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const { date } = z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(request.params)
    await loadOwnedGoal(request.user.id, id)
    await sql`delete from goal_entries where goal_id = ${id} and logged_on = ${date}`
    reply.code(204)
    return null
  })
}
