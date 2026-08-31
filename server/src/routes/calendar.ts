import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { addDays, buildIcs } from '@ct/shared'
import { sql, toChallenge, toScheduledEvent } from '../db.js'
import { notFound } from '../errors.js'

/**
 * The subscribable calendar feed.
 *
 * This route is deliberately outside the authenticated scope: a calendar client cannot
 * send a bearer token, so the only credential it can carry is the URL itself. The token
 * is a random uuid, unique per user, and rotating it revokes every existing subscription.
 *
 * A wrong or unknown token returns 404 with no detail, exactly as an owned resource does.
 */
export async function calendarRoutes(app: FastifyInstance) {
  app.get('/api/calendar/:token.ics', async (request, reply) => {
    const { token } = z
      .object({ token: z.string().uuid() })
      .parse({ token: (request.params as { token: string }).token })

    const [profile] = await sql`select id from profiles where calendar_token = ${token}`
    if (!profile) throw notFound('Calendar')

    const [challengeRow] = await sql`
      select * from challenges
      where user_id = ${profile.id as string} and status = 'active'
    `
    // No active challenge is not an error: hand back an empty but valid calendar so a
    // subscribed client simply shows nothing rather than reporting a broken feed.
    const challenge = challengeRow ? toChallenge(challengeRow) : null

    const eventRows = challenge
      ? await sql`select * from scheduled_events where challenge_id = ${challenge.id}`
      : []

    const ics = buildIcs({
      events: eventRows.map(toScheduledEvent),
      timezone: challenge?.timezone ?? 'UTC',
      from: challenge?.startDate ?? '2026-01-01',
      until: challenge ? addDays(challenge.startDate, challenge.lengthDays - 1) : '2026-01-01',
      calendarName: challenge?.name ?? 'Challenge',
    })

    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      // Subscribed clients poll on their own schedule; a short cache keeps a burst of
      // refreshes from hitting the database repeatedly without making edits feel stale.
      .header('Cache-Control', 'public, max-age=900')
      .header('Content-Disposition', 'inline; filename="challenge.ics"')
      .send(ics)
  })
}

/** The user's own feed URL, and the ability to revoke it. */
export async function calendarLinkRoutes(app: FastifyInstance) {
  app.get('/api/calendar-link', async (request) => {
    const [row] = await sql`select calendar_token from profiles where id = ${request.user.id}`
    return { token: row ? String(row.calendar_token) : null }
  })

  app.post('/api/calendar-link/rotate', async (request) => {
    const [row] = await sql`
      update profiles set calendar_token = gen_random_uuid()
      where id = ${request.user.id}
      returning calendar_token
    `
    return { token: String(row!.calendar_token) }
  })
}
