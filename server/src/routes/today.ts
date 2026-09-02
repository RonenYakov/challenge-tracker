import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  activeDayNumber,
  activeDaysElapsed,
  bestStreakEver,
  computeStreak,
  dayCompletion,
  findUnresolvedMiss,
  candleLighting,
  clockTimeIn,
  graceTokensRemaining,
  havdalah,
  isRestDay,
  locationFor,
  previousActiveDate,
  weekdayOf,
} from '@ct/shared'
import type { Challenge } from '@ct/shared'
import { sql, toChallengeEvent, toDayLog } from '../db.js'
import { loadActiveChallenge, loadOwnedChallenge } from '../ownership.js'
import { notFound } from '../errors.js'
import {
  activeDateFor,
  activeTasks,
  entriesFor,
  openDayForWriting,
  refreshDayStatus,
  setEntryValue,
  startTimer,
  stopTimer,
} from '../days.js'

const dateParam = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
const dateTaskParams = dateParam.extend({ taskId: z.string().uuid() })

export async function todayRoutes(app: FastifyInstance) {
  /**
   * Everything the Today screen needs in one request: the active challenge, its tasks,
   * today's entries, the streak, and whether a reckoning is owed.
   */
  app.get('/api/today', async (request) => {
    const challenge = await loadActiveChallenge(request.user.id)
    if (!challenge) return { challenge: null }

    const date = activeDateFor(challenge)
    const [tasks, dayRows, eventRows] = await Promise.all([
      activeTasks(challenge.id),
      sql`select * from day_logs where challenge_id = ${challenge.id} order by log_date asc`,
      sql`select * from challenge_events where challenge_id = ${challenge.id}`,
    ])

    const days = dayRows.map(toDayLog)
    const currentAttempt = days.filter((d) => d.attemptNo === challenge.attemptNo)
    const todayLog = currentAttempt.find((d) => d.logDate === date) ?? null
    const entries = todayLog ? await entriesFor(todayLog.id) : []

    const rest = challenge.restWeekdays
    const restDay = isRestDay(date, rest)
    const elapsed = activeDaysElapsed(date, challenge.startDate, rest, challenge.lengthDays)

    return {
      challenge,
      tasks,
      date,
      isRestDay: restDay,
      // Null on a rest day: there is no day number because no day of the challenge is
      // being spent. `daysRemaining` still answers, which is what the header needs.
      dayNumber: activeDayNumber(date, challenge.startDate, rest),
      daysRemaining: Math.max(0, challenge.lengthDays - elapsed),
      shabbat: shabbatNoticeFor(challenge, date),
      entries,
      note: todayLog?.note ?? null,
      completion: dayCompletion(entries, tasks),
      streak: computeStreak(currentAttempt, rest),
      // Never-miss-twice: the day after a miss is where a slip becomes a collapse,
      // so the client is told explicitly rather than inferring it. The day before is
      // the previous ACTIVE day, or Sunday would never mention a missed Friday.
      missedYesterday:
        currentAttempt.find((d) => d.logDate === previousActiveDate(date, rest))?.status ===
        'incomplete',
      bestEver: bestStreakEver(days, rest),
      graceTokensRemaining: graceTokensRemaining(challenge, eventRows.map(toChallengeEvent)),
      unresolvedMiss: findUnresolvedMiss(days, challenge, new Date()),
    }
  })

  /** A read-only view of any past day, for the grid. */
  app.get('/api/challenges/:id/days/:date', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const { date } = dateParam.parse(request.params)
    const challenge = await loadOwnedChallenge(request.user.id, id)

    const [row] = await sql`
      select * from day_logs where challenge_id = ${id} and log_date = ${date}
    `
    const tasks = await activeTasks(id)
    const day = row ? toDayLog(row) : null
    const entries = day ? await entriesFor(day.id) : []

    return { day, tasks, entries, completion: dayCompletion(entries, tasks) }
  })

  app.put('/api/days/:date/entries/:taskId', async (request) => {
    const { date, taskId } = dateTaskParams.parse(request.params)
    const { value } = z.object({ value: z.number().min(0).max(99_999_999) }).parse(request.body)

    const challenge = await requireActive(request.user.id)
    const tasks = await activeTasks(challenge.id)
    if (!tasks.some((t) => t.id === taskId)) throw notFound('Task')

    const dayLog = await openDayForWriting(challenge, date)
    await setEntryValue(dayLog, taskId, value)
    return summarise(challenge, dayLog)
  })

  app.post('/api/days/:date/timer/:taskId/start', async (request) => {
    const { date, taskId } = dateTaskParams.parse(request.params)
    const challenge = await requireActive(request.user.id)
    const tasks = await activeTasks(challenge.id)
    if (!tasks.some((t) => t.id === taskId && t.kind === 'timer')) throw notFound('Timer task')

    const dayLog = await openDayForWriting(challenge, date)
    await startTimer(dayLog, taskId)
    return summarise(challenge, dayLog)
  })

  /**
   * The day's journal entry. Saved on its own rather than through the entry endpoints,
   * because writing a note is not progress on a rule and must never move the ring.
   */
  app.put('/api/days/:date/note', async (request) => {
    const { date } = dateParam.parse(request.params)
    const { note } = z
      .object({ note: z.string().max(5000).nullable() })
      .parse(request.body)

    const challenge = await requireActive(request.user.id)
    const dayLog = await openDayForWriting(challenge, date)

    const trimmed = note?.trim()
    const [row] = await sql`
      update day_logs
      set note = ${trimmed ? trimmed : null}
      where id = ${dayLog.id}
      returning *
    `
    return { day: toDayLog(row!) }
  })

  app.post('/api/days/:date/timer/:taskId/stop', async (request) => {
    const { date, taskId } = dateTaskParams.parse(request.params)
    const challenge = await requireActive(request.user.id)
    const dayLog = await openDayForWriting(challenge, date)
    await stopTimer(dayLog, taskId)
    return summarise(challenge, dayLog)
  })
}

/**
 * The Shabbat deadline to show, or null.
 *
 * Shabbat runs Friday evening to Saturday night, but the rest day is the whole civil
 * Saturday, because a half day cannot be the unit a streak is counted in. Friday stays
 * required, so instead of moving the boundary the app just says when the deadline is.
 *
 * Null unless Saturday is actually set aside, the timezone is one we have coordinates
 * for, and there is a sunset that day. A wrong time here is worse than no time.
 */
function shabbatNoticeFor(challenge: Challenge, date: string) {
  if (!challenge.restWeekdays.includes(6)) return null

  const location = locationFor(challenge.timezone)
  if (!location) return null

  const weekday = weekdayOf(date)
  const instant =
    weekday === 5 ? candleLighting(date, location) : weekday === 6 ? havdalah(date, location) : null
  if (!instant) return null

  return {
    kind: weekday === 5 ? ('candle-lighting' as const) : ('havdalah' as const),
    at: clockTimeIn(instant, challenge.timezone),
    label: location.label,
    approximate: true as const,
  }
}

async function requireActive(userId: string) {
  const challenge = await loadActiveChallenge(userId)
  if (!challenge) throw notFound('Active challenge')
  return challenge
}

/** Re-scores the day and hands back the authoritative state, so the client can reconcile. */
async function summarise(challenge: Awaited<ReturnType<typeof requireActive>>, dayLog: Awaited<ReturnType<typeof openDayForWriting>>) {
  const refreshed = await refreshDayStatus(challenge, dayLog)
  const [tasks, entries] = await Promise.all([activeTasks(challenge.id), entriesFor(refreshed.id)])
  const dayRows = await sql`
    select * from day_logs
    where challenge_id = ${challenge.id} and attempt_no = ${challenge.attemptNo}
    order by log_date asc
  `
  return {
    day: refreshed,
    entries,
    completion: dayCompletion(entries, tasks),
    streak: computeStreak(dayRows.map(toDayLog), challenge.restWeekdays),
  }
}
