import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { occurrencesBetween } from '@ct/shared'
import { addDays } from '@ct/shared'
import { sql, toScheduledEvent } from '../db.js'
import { loadOwnedChallenge } from '../ownership.js'
import { notFound } from '../errors.js'
import { activeDateFor } from '../days.js'

const idParam = z.object({ id: z.string().uuid() })

const eventFields = z.object({
  title: z.string().trim().min(1).max(200),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM'),
  durationMinutes: z.number().int().min(5).max(1440).default(60),
})

export async function eventRoutes(app: FastifyInstance) {
  /** The events themselves, plus the fortnight ahead already expanded into dates. */
  app.get('/api/challenges/:id/events', async (request) => {
    const { id } = idParam.parse(request.params)
    const challenge = await loadOwnedChallenge(request.user.id, id)
    const today = activeDateFor(challenge)

    const rows = await sql`
      select * from scheduled_events where challenge_id = ${id}
      order by time_of_day asc, created_at asc
    `
    const events = rows.map(toScheduledEvent)

    return {
      events,
      upcoming: occurrencesBetween(events, today, addDays(today, 13)),
    }
  })

  app.post('/api/challenges/:id/events', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const body = eventFields.parse(request.body)
    await loadOwnedChallenge(request.user.id, id)

    const [row] = await sql`
      insert into scheduled_events ${sql({
        challenge_id: id,
        title: body.title,
        // Deduplicated: the same weekday twice would double every occurrence.
        weekdays: [...new Set(body.weekdays)].sort((a, b) => a - b),
        time_of_day: body.timeOfDay,
        duration_minutes: body.durationMinutes,
      })}
      returning *
    `
    reply.code(201)
    return { event: toScheduledEvent(row!) }
  })

  app.patch('/api/events/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    const body = eventFields.partial().parse(request.body)
    const existing = await loadOwnedEvent(request.user.id, id)

    const patch = {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.weekdays !== undefined && {
        weekdays: [...new Set(body.weekdays)].sort((a, b) => a - b),
      }),
      ...(body.timeOfDay !== undefined && { time_of_day: body.timeOfDay }),
      ...(body.durationMinutes !== undefined && { duration_minutes: body.durationMinutes }),
    }
    if (Object.keys(patch).length === 0) return { event: existing }

    // Changing the schedule invalidates whatever is in Google, so the sync stamp is
    // cleared and the next push updates the existing calendar entry.
    const [row] = await sql`
      update scheduled_events set ${sql(patch)}, synced_at = null
      where id = ${id} returning *
    `
    return { event: toScheduledEvent(row!) }
  })

  app.delete('/api/events/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    await loadOwnedEvent(request.user.id, id)
    await sql`delete from scheduled_events where id = ${id}`
    reply.code(204)
    return null
  })
}

/** Same 404-not-403 rule as everything else with an id. */
async function loadOwnedEvent(userId: string, eventId: string) {
  const [row] = await sql`
    select e.* from scheduled_events e
    join challenges c on c.id = e.challenge_id
    where e.id = ${eventId} and c.user_id = ${userId}
  `
  if (!row) throw notFound('Event')
  return toScheduledEvent(row)
}
