import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { suggestAnchors } from '@ct/shared'
import type { RoutineProfile } from '@ct/shared'
import { sql, toRoutineProfile, toTask } from '../db.js'
import { loadOwnedChallenge } from '../ownership.js'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM').nullable()

const routineFields = z.object({
  wakeTime: time.default(null),
  workStart: time.default(null),
  workEnd: time.default(null),
  sleepTime: time.default(null),
  hasKids: z.boolean().default(false),
})

const EMPTY: RoutineProfile = {
  wakeTime: null,
  workStart: null,
  workEnd: null,
  sleepTime: null,
  hasKids: false,
  updatedAt: '',
}

export async function routineRoutes(app: FastifyInstance) {
  app.get('/api/routine', async (request) => {
    const [row] = await sql`select * from routine_profiles where user_id = ${request.user.id}`
    return { routine: row ? toRoutineProfile(row) : null }
  })

  app.put('/api/routine', async (request) => {
    const body = routineFields.parse(request.body)
    const [row] = await sql`
      insert into routine_profiles ${sql({
        user_id: request.user.id,
        wake_time: body.wakeTime,
        work_start: body.workStart,
        work_end: body.workEnd,
        sleep_time: body.sleepTime,
        has_kids: body.hasKids,
      })}
      on conflict (user_id) do update set
        wake_time = excluded.wake_time,
        work_start = excluded.work_start,
        work_end = excluded.work_end,
        sleep_time = excluded.sleep_time,
        has_kids = excluded.has_kids
      returning *
    `
    return { routine: toRoutineProfile(row!) }
  })

  /**
   * Candidate anchors per task, computed from the user's own routine.
   *
   * These are proposals, never applied automatically. Accepting one writes it to the
   * task's cue exactly as any hand-typed cue would, so there is no second class of
   * "suggested" cue to reason about later.
   */
  app.get('/api/challenges/:id/anchor-suggestions', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await loadOwnedChallenge(request.user.id, id)

    const [routineRow] = await sql`
      select * from routine_profiles where user_id = ${request.user.id}
    `
    const routine = routineRow ? toRoutineProfile(routineRow) : EMPTY

    const taskRows = await sql`
      select * from tasks where challenge_id = ${id} and is_active = true
      order by sort_order asc
    `

    return {
      routine: routineRow ? routine : null,
      suggestions: taskRows.map(toTask).map((task) => ({
        taskId: task.id,
        label: task.label,
        currentCue: task.cue,
        anchors: suggestAnchors(routine, task),
      })),
    }
  })
}
