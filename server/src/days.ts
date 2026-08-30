import type { Challenge, DayLog, ISODate, Task, TaskEntry } from '@ct/shared'
import { canBackfill, dayCompletion, dayNumber, resolveActiveDate } from '@ct/shared'
import { sql, toDayLog, toTask, toTaskEntry } from './db.js'
import { badRequest, notFound } from './errors.js'

export function activeDateFor(challenge: Challenge, now = new Date()): ISODate {
  return resolveActiveDate(now, challenge.dayCutoffHour, challenge.timezone)
}

export async function activeTasks(challengeId: string): Promise<Task[]> {
  const rows = await sql`
    select * from tasks
    where challenge_id = ${challengeId} and is_active = true
    order by sort_order asc, created_at asc
  `
  return rows.map(toTask)
}

export async function entriesFor(dayLogId: string): Promise<TaskEntry[]> {
  const rows = await sql`select * from task_entries where day_log_id = ${dayLogId}`
  return rows.map(toTaskEntry)
}

/**
 * The day row for a date, created on first touch.
 *
 * Writes are allowed for the logical today and, once, for the day before it. Anything
 * older is closed for good, which is the difference between a log and a wish list.
 */
export async function openDayForWriting(
  challenge: Challenge,
  date: ISODate,
  now = new Date(),
): Promise<DayLog> {
  const today = activeDateFor(challenge, now)
  const isToday = date === today
  const isBackfill = canBackfill(date, now, challenge.dayCutoffHour, challenge.timezone)

  if (!isToday && !isBackfill) {
    throw badRequest(
      date > today
        ? 'That day has not started yet.'
        : 'That day is closed. Only today and yesterday can be edited.',
    )
  }

  const day = dayNumber(date, challenge.startDate)
  if (day < 1 || day > challenge.lengthDays) {
    throw badRequest('That date falls outside the challenge.')
  }

  const [row] = await sql`
    insert into day_logs (challenge_id, log_date, day_number, attempt_no, status, logged_late)
    values (${challenge.id}, ${date}, ${day}, ${challenge.attemptNo}, 'pending', ${isBackfill})
    on conflict (challenge_id, log_date) do update
      set logged_late = day_logs.logged_late or ${isBackfill},
          -- A reset on the same calendar day leaves this row stamped with the old
          -- attempt and day number. Without re-stamping it, the day is filtered out of
          -- the new attempt and a completed day shows a streak of zero.
          attempt_no = excluded.attempt_no,
          day_number = excluded.day_number
    returning *
  `
  return toDayLog(row!)
}

/** Recomputes a day's status from its entries. Called after every write to an entry. */
export async function refreshDayStatus(challenge: Challenge, dayLog: DayLog): Promise<DayLog> {
  const [tasks, entries] = await Promise.all([activeTasks(challenge.id), entriesFor(dayLog.id)])
  const complete = dayCompletion(entries, tasks) === 1

  const [row] = await sql`
    update day_logs
    set status    = ${complete ? 'complete' : 'pending'},
        closed_at = ${complete ? sql`now()` : null}
    where id = ${dayLog.id}
    returning *
  `
  return toDayLog(row!)
}

export async function setEntryValue(
  dayLog: DayLog,
  taskId: string,
  value: number,
): Promise<TaskEntry> {
  const [row] = await sql`
    insert into task_entries (day_log_id, task_id, value)
    values (${dayLog.id}, ${taskId}, ${value})
    on conflict (day_log_id, task_id) do update
      set value = excluded.value, timer_started_at = null
    returning *
  `
  return toTaskEntry(row!)
}

export async function startTimer(dayLog: DayLog, taskId: string): Promise<TaskEntry> {
  const [row] = await sql`
    insert into task_entries (day_log_id, task_id, value, timer_started_at)
    values (${dayLog.id}, ${taskId}, 0, now())
    on conflict (day_log_id, task_id) do update
      -- Starting an already-running timer is a no-op rather than an error, so a
      -- double tap or a second device cannot silently restart the clock.
      set timer_started_at = coalesce(task_entries.timer_started_at, now())
    returning *
  `
  return toTaskEntry(row!)
}

/** Banks the elapsed minutes into `value` and clears the running clock. */
export async function stopTimer(dayLog: DayLog, taskId: string): Promise<TaskEntry> {
  const [row] = await sql`
    update task_entries
    set value = value + case
          when timer_started_at is null then 0
          else extract(epoch from (now() - timer_started_at)) / 60
        end,
        timer_started_at = null
    where day_log_id = ${dayLog.id} and task_id = ${taskId}
    returning *
  `
  if (!row) throw notFound('Timer')
  return toTaskEntry(row)
}
