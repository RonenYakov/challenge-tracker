import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql, toTask } from '../db.js'
import { loadOwnedChallenge, loadOwnedTask } from '../ownership.js'
import { badRequest } from '../errors.js'

/**
 * A task is a checkbox unless it is given a target. Requiring the target for count and
 * timer kinds is enforced here and again by a check constraint in the database.
 */
const TARGET_RULE = 'A counter or timer task needs a target; a checkbox must not have one.'

const taskFields = z.object({
  label: z.string().trim().min(1).max(200),
  kind: z.enum(['check', 'count', 'timer']).default('check'),
  targetValue: z.number().positive().max(99_999_999).nullable().default(null),
  unit: z.string().trim().max(20).nullable().default(null),
  sortOrder: z.number().int().min(0).default(0),
  cue: z.string().trim().max(120).nullable().default(null),
  scheduleMode: z.enum(['unset', 'anytime', 'fixed', 'anchored']).default('unset'),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM').nullable().default(null),
})

const createTask = taskFields.refine(
  (t) => (t.kind === 'check' ? t.targetValue === null : t.targetValue !== null),
  { message: TARGET_RULE, path: ['targetValue'] },
)

/** Partial must come off the plain object; a refined schema cannot be made partial. */
const updateTask = taskFields.partial()

const idParam = z.object({ id: z.string().uuid() })

export async function taskRoutes(app: FastifyInstance) {
  app.get('/api/challenges/:id/tasks', async (request) => {
    const { id } = idParam.parse(request.params)
    await loadOwnedChallenge(request.user.id, id)
    const rows = await sql`
      select * from tasks
      where challenge_id = ${id}
      order by is_active desc, sort_order asc, created_at asc
    `
    return { tasks: rows.map(toTask) }
  })

  app.post('/api/challenges/:id/tasks', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const body = createTask.parse(request.body)
    await loadOwnedChallenge(request.user.id, id)

    const [row] = await sql`
      insert into tasks ${sql({
        challenge_id: id,
        label: body.label,
        kind: body.kind,
        target_value: body.targetValue,
        unit: body.unit,
        sort_order: body.sortOrder,
        cue: body.cue,
        schedule_mode: body.scheduleMode,
        scheduled_time: body.scheduleMode === 'fixed' ? body.scheduledTime : null,
      })}
      returning *
    `
    reply.code(201)
    return { task: toTask(row!) }
  })

  app.patch('/api/tasks/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    const body = updateTask.parse(request.body)
    const { task, challenge } = await loadOwnedTask(request.user.id, id)

    if (body.scheduleMode === 'fixed' && !(body.scheduledTime ?? task.scheduledTime)) {
      throw badRequest('כלל בשעה קבועה חייב שעה.')
    }

    const kind = body.kind ?? task.kind
    const targetValue = body.targetValue !== undefined ? body.targetValue : task.targetValue
    if (kind === 'check' ? targetValue !== null : targetValue === null) {
      throw badRequest(TARGET_RULE)
    }

    // Changing a rule mid-run would retroactively rewrite whether past days passed.
    if (challenge.status === 'active' && (body.kind !== undefined || body.targetValue !== undefined)) {
      throw badRequest(
        'A task’s type or target cannot change while the challenge is running. Retire it and add a new one instead.',
      )
    }

    const patch = {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.kind !== undefined && { kind: body.kind }),
      ...(body.targetValue !== undefined && { target_value: body.targetValue }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.sortOrder !== undefined && { sort_order: body.sortOrder }),
      // The cue is a note to yourself about when and where, not a scoring rule,
      // so unlike kind and target it stays editable mid-challenge.
      ...(body.cue !== undefined && { cue: body.cue }),
      ...(body.scheduleMode !== undefined && { schedule_mode: body.scheduleMode }),
    }

    // The database rejects a time on a non-fixed rule, so keep the pair consistent
    // here rather than letting a mode change trip a constraint.
    const nextMode = body.scheduleMode ?? task.scheduleMode
    if (body.scheduleMode !== undefined || body.scheduledTime !== undefined) {
      Object.assign(patch, {
        scheduled_time: nextMode === 'fixed' ? (body.scheduledTime ?? task.scheduledTime) : null,
      })
    }
    if (Object.keys(patch).length === 0) return { task }

    const [row] = await sql`update tasks set ${sql(patch)} where id = ${id} returning *`
    return { task: toTask(row!) }
  })

  /**
   * Retires a task rather than deleting it once the challenge is running, so the days
   * already scored against it keep making sense. A draft challenge deletes outright.
   */
  app.delete('/api/tasks/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const { challenge } = await loadOwnedTask(request.user.id, id)

    if (challenge.status === 'draft') {
      await sql`delete from tasks where id = ${id}`
    } else {
      await sql`update tasks set is_active = false where id = ${id}`
    }
    reply.code(204)
    return null
  })
}
