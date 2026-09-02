import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql, toChallenge, toChallengeEvent, toDayLog } from '../db.js'
import { loadOwnedChallenge } from '../ownership.js'
import { badRequest, conflict } from '../errors.js'
import { activeDateFor } from '../days.js'
import {
  activeDaysElapsed,
  findUnresolvedMiss,
  firstActiveOnOrAfter,
  graceTokensRemaining,
  isRestDay,
} from '@ct/shared'

const createBody = z.object({
  name: z.string().trim().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lengthDays: z.number().int().min(1).max(1000),
  dayCutoffHour: z.number().int().min(0).max(23).default(4),
  timezone: z.string().min(1).default('Asia/Jerusalem'),
  graceTokensTotal: z.number().int().min(0).max(365).default(0),
  // 0 = Sunday through 6 = Saturday. Six at most: seven would leave no days at all.
  restWeekdays: z
    .array(z.number().int().min(0).max(6))
    .max(6)
    .transform((days) => [...new Set(days)].sort((a, b) => a - b))
    .default([]),
})

const updateBody = createBody.partial()

const idParam = z.object({ id: z.string().uuid() })

export async function challengeRoutes(app: FastifyInstance) {
  app.get('/api/challenges', async (request) => {
    const rows = await sql`
      select * from challenges
      where user_id = ${request.user.id}
      order by
        case status when 'active' then 0 when 'draft' then 1 else 2 end,
        start_date desc
    `
    return { challenges: rows.map(toChallenge) }
  })

  app.get('/api/challenges/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    return { challenge: await loadOwnedChallenge(request.user.id, id) }
  })

  app.post('/api/challenges', async (request, reply) => {
    const body = createBody.parse(request.body)
    assertKnownTimezone(body.timezone)
    assertStartIsActive(body.startDate, body.restWeekdays)

    const [row] = await sql`
      insert into challenges ${sql({
        user_id: request.user.id,
        name: body.name,
        start_date: body.startDate,
        length_days: body.lengthDays,
        day_cutoff_hour: body.dayCutoffHour,
        timezone: body.timezone,
        grace_tokens_total: body.graceTokensTotal,
        rest_weekdays: body.restWeekdays,
        status: 'draft',
      })}
      returning *
    `
    reply.code(201)
    return { challenge: toChallenge(row!) }
  })

  app.patch('/api/challenges/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    const body = updateBody.parse(request.body)
    const existing = await loadOwnedChallenge(request.user.id, id)

    if (body.timezone) assertKnownTimezone(body.timezone)

    // Moving the goalposts mid-run would silently rewrite every day number already
    // logged. Rest days belong in that list too: setting Saturdays aside halfway would
    // drop every completed Saturday out of the streak and slide the finish line.
    if (existing.status === 'active' && (body.startDate || body.lengthDays || body.restWeekdays)) {
      throw badRequest(
        'אי אפשר לשנות תאריך התחלה, אורך או ימי מנוחה בזמן שהאתגר רץ.',
      )
    }

    // Validate against the merged result: a patch that only moves the start date still
    // has to agree with the rest days already stored, and the other way round.
    assertStartIsActive(
      body.startDate ?? existing.startDate,
      body.restWeekdays ?? existing.restWeekdays,
    )

    const patch = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.startDate !== undefined && { start_date: body.startDate }),
      ...(body.lengthDays !== undefined && { length_days: body.lengthDays }),
      ...(body.dayCutoffHour !== undefined && { day_cutoff_hour: body.dayCutoffHour }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.graceTokensTotal !== undefined && { grace_tokens_total: body.graceTokensTotal }),
      ...(body.restWeekdays !== undefined && { rest_weekdays: body.restWeekdays }),
    }
    if (Object.keys(patch).length === 0) return { challenge: existing }

    const [row] = await sql`
      update challenges set ${sql(patch)} where id = ${id} returning *
    `
    return { challenge: toChallenge(row!) }
  })

  app.post('/api/challenges/:id/activate', async (request) => {
    const { id } = idParam.parse(request.params)
    const challenge = await loadOwnedChallenge(request.user.id, id)
    if (challenge.status === 'active') return { challenge }

    const taskCount = await sql`
      select count(*)::int as count from tasks
      where challenge_id = ${id} and is_active = true
    `
    if (Number(taskCount[0]?.count ?? 0) === 0) {
      throw badRequest('צריך להוסיף לפחות כלל אחד לפני שמתחילים אתגר.')
    }
    // Rest days could have been changed after the start date was picked, while the
    // challenge was still a draft, so this is the last chance to catch a clash.
    assertStartIsActive(challenge.startDate, challenge.restWeekdays)

    // Stand down the current challenge and raise this one atomically, so the partial
    // unique index can never see two active rows mid-flight.
    const [row] = await sql.begin(async (tx) => {
      await tx`
        update challenges set status = 'abandoned'
        where user_id = ${request.user.id} and status = 'active' and id <> ${id}
      `
      return tx`update challenges set status = 'active' where id = ${id} returning *`
    })
    return { challenge: toChallenge(row!) }
  })

  app.delete('/api/challenges/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    await loadOwnedChallenge(request.user.id, id)
    await sql`delete from challenges where id = ${id}`
    reply.code(204)
    return null
  })

  /**
   * The reckoning. Called when the client is shown an unresolved miss and the user
   * picks a side. The miss is recomputed here rather than trusted from the request,
   * so a crafted call cannot spend a token on a day that was actually fine.
   */
  app.post('/api/challenges/:id/resolve-miss', async (request) => {
    const { id } = idParam.parse(request.params)
    const { action } = z.object({ action: z.enum(['grace', 'reset']) }).parse(request.body)
    const challenge = await loadOwnedChallenge(request.user.id, id)

    const dayRows = await sql`select * from day_logs where challenge_id = ${id}`
    const eventRows = await sql`select * from challenge_events where challenge_id = ${id}`
    const miss = findUnresolvedMiss(dayRows.map(toDayLog), challenge, new Date())
    if (!miss) throw conflict('אין שום דבר לפתור.')

    if (action === 'grace') {
      const remaining = graceTokensRemaining(challenge, eventRows.map(toChallengeEvent))
      if (remaining <= 0) throw conflict('לא נותרו אסימוני חסד.')

      await sql.begin(async (tx) => {
        await tx`
          insert into day_logs (challenge_id, log_date, day_number, attempt_no, status)
          values (${id}, ${miss.date}, ${miss.dayNumber}, ${challenge.attemptNo}, 'graced')
          on conflict (challenge_id, log_date) do update set status = 'graced'
        `
        await tx`
          insert into challenge_events (challenge_id, type, day_number, attempt_no)
          values (${id}, 'grace_spent', ${miss.dayNumber}, ${challenge.attemptNo})
        `
      })
    } else {
      const today = activeDateFor(challenge)
      // Day 1 has to be a day with something due. Resetting on a Saturday would
      // otherwise create an attempt whose first day can never be logged.
      const newStart = firstActiveOnOrAfter(today, challenge.restWeekdays)
      await sql.begin(async (tx) => {
        await tx`
          insert into day_logs (challenge_id, log_date, day_number, attempt_no, status)
          values (${id}, ${miss.date}, ${miss.dayNumber}, ${challenge.attemptNo}, 'incomplete')
          on conflict (challenge_id, log_date) do update set status = 'incomplete'
        `
        await tx`
          insert into challenge_events (challenge_id, type, day_number, attempt_no)
          values (${id}, 'reset', ${miss.dayNumber}, ${challenge.attemptNo})
        `
        // The old attempt's days keep their attempt_no, so the grid still shows the
        // run that failed. Deleting it would be tidier and less honest.
        await tx`
          update challenges
          set start_date = ${newStart}, attempt_no = attempt_no + 1
          where id = ${id}
        `
        // The new start becomes day 1. If a row for it already exists from the run that
        // just ended, re-stamp it rather than leaving it orphaned under the old attempt,
        // where it would not count toward the new streak. When the reset lands on a rest
        // day there is no such row and day 1 simply waits until tomorrow.
        await tx`
          update day_logs
          set attempt_no = ${challenge.attemptNo + 1}, day_number = 1
          where challenge_id = ${id} and log_date = ${newStart}
        `
      })
    }

    const [row] = await sql`select * from challenges where id = ${id}`
    return { challenge: toChallenge(row!) }
  })

  app.get('/api/challenges/:id/days', async (request) => {
    const { id } = idParam.parse(request.params)
    await loadOwnedChallenge(request.user.id, id)
    const rows = await sql`
      select * from day_logs where challenge_id = ${id} order by log_date asc
    `
    return { days: rows.map(toDayLog) }
  })

  app.get('/api/challenges/:id/stats', async (request) => {
    const { id } = idParam.parse(request.params)
    const challenge = await loadOwnedChallenge(request.user.id, id)

    const eventRows = await sql`select * from challenge_events where challenge_id = ${id}`

    /**
     * Per-task completion rate across closed days of the current attempt: the number
     * that names which rule is actually breaking you, rather than just that you broke.
     */
    const perTask = await sql`
      with closed as (
        select id from day_logs
        where challenge_id = ${id}
          and attempt_no = ${challenge.attemptNo}
          and log_date < ${activeDateFor(challenge)}
      )
      select t.id,
             t.label,
             t.kind,
             t.target_value,
             t.unit,
             (select count(*) from closed)::int as closed_days,
             count(e.id) filter (
               where e.value >= coalesce(t.target_value, 1)
             )::int as completed_days
      from tasks t
      left join task_entries e
        on e.task_id = t.id and e.day_log_id in (select id from closed)
      where t.challenge_id = ${id} and t.is_active = true
      group by t.id, t.label, t.kind, t.target_value, t.unit
      order by t.sort_order asc
    `

    return {
      graceTokensRemaining: graceTokensRemaining(challenge, eventRows.map(toChallengeEvent)),
      graceTokensTotal: challenge.graceTokensTotal,
      currentDayNumber: activeDaysElapsed(
        activeDateFor(challenge),
        challenge.startDate,
        challenge.restWeekdays,
        challenge.lengthDays,
      ),
      taskRates: perTask.map((r) => ({
        taskId: String(r.id),
        label: String(r.label),
        kind: String(r.kind),
        targetValue: r.target_value === null ? null : Number(r.target_value),
        unit: r.unit === null ? null : String(r.unit),
        closedDays: Number(r.closed_days),
        completedDays: Number(r.completed_days),
      })),
    }
  })
}

/** Guards against a typo'd zone that would silently break every date boundary. */
function assertKnownTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
  } catch {
    throw badRequest(`אזור זמן לא מוכר: ${timezone}`)
  }
}

/**
 * Day 1 has to be a day with something due on it.
 *
 * Snapping the date forward on the user's behalf would be the friendlier-looking
 * option and the worse one: a start date that quietly moved is indistinguishable
 * from a bug. Name the date that works instead and let them choose it.
 */
function assertStartIsActive(startDate: string, restWeekdays: number[]): void {
  if (!isRestDay(startDate, restWeekdays)) return
  const next = firstActiveOnOrAfter(startDate, restWeekdays)
  throw badRequest(`אתגר לא יכול להתחיל ביום מנוחה. התאריך הראשון שמתאים הוא ${next}.`)
}
