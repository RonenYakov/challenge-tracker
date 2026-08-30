import type { Challenge, ChallengeEvent, DayLog, ISODate, Miss, Streak, Task, TaskEntry } from './types.js'

const DAY_MS = 86_400_000
const RESOLVED: ReadonlySet<DayLog['status']> = new Set(['complete', 'graced'])

/**
 * The wall-clock date and hour at `instant`, as seen in `timeZone`.
 * Intl is the only thing in the platform that knows about DST rules, so it does the work.
 */
function zonedParts(instant: Date, timeZone: string): { date: ISODate; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  }
}

/** Shift a date-only string by whole days. Done in UTC so DST can never move the result. */
export function addDays(date: ISODate, days: number): ISODate {
  const shifted = new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
  return shifted.toISOString().slice(0, 10)
}

/**
 * The day the user is currently logging against.
 * With a 4am cutoff, 01:30 still belongs to the previous day, which is the whole point:
 * finishing at 1am should not cost a streak.
 */
export function resolveActiveDate(now: Date, cutoffHour: number, timeZone: string): ISODate {
  const { date, hour } = zonedParts(now, timeZone)
  return hour < cutoffHour ? addDays(date, -1) : date
}

/** 1-based day index within the challenge. The start date is day 1. */
export function dayNumber(logDate: ISODate, startDate: ISODate): number {
  const diff = (Date.parse(`${logDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS
  return Math.round(diff) + 1
}

/** The target a task must reach to count as done. A checkbox is simply 1. */
function targetFor(task: Task): number {
  if (task.kind === 'check') return 1
  return task.targetValue ?? 1
}

/** Fraction of the day's active tasks that hit their target, 0..1. */
export function dayCompletion(entries: readonly TaskEntry[], tasks: readonly Task[]): number {
  const active = tasks.filter((t) => t.isActive)
  if (active.length === 0) return 0

  const valueByTask = new Map(entries.map((e) => [e.taskId, e.value]))
  const done = active.filter((t) => (valueByTask.get(t.id) ?? 0) >= targetFor(t)).length
  return done / active.length
}

/**
 * The earliest closed day of the current attempt that is neither complete nor graced.
 * A day is only "closed" once the logical date has moved past it, so today is never flagged.
 */
export function findUnresolvedMiss(
  dayLogs: readonly DayLog[],
  challenge: Challenge,
  now: Date,
): Miss | null {
  const activeDate = resolveActiveDate(now, challenge.dayCutoffHour, challenge.timezone)
  const lastRequiredDay = Math.min(
    dayNumber(activeDate, challenge.startDate) - 1,
    challenge.lengthDays,
  )
  if (lastRequiredDay < 1) return null

  const byDate = new Map(
    dayLogs.filter((d) => d.attemptNo === challenge.attemptNo).map((d) => [d.logDate, d]),
  )

  for (let day = 1; day <= lastRequiredDay; day++) {
    const date = addDays(challenge.startDate, day - 1)
    const log = byDate.get(date)
    if (!log || !RESOLVED.has(log.status)) {
      return { date, dayNumber: day }
    }
  }
  return null
}

/**
 * Current and best run of unbroken days. Graced days keep a run alive.
 * A trailing `pending` day is today, still in play, so it neither counts nor breaks.
 */
export function computeStreak(dayLogs: readonly DayLog[]): Streak {
  const sorted = [...dayLogs].sort((a, b) => a.logDate.localeCompare(b.logDate))

  let best = 0
  let run = 0
  let current = 0

  for (let i = 0; i < sorted.length; i++) {
    const log = sorted[i]!
    const previous = i > 0 ? sorted[i - 1] : undefined
    const isConsecutive = previous ? addDays(previous.logDate, 1) === log.logDate : true

    if (log.status === 'pending') {
      // Today, undecided. Freeze the run as it stands rather than counting or breaking it.
      continue
    }

    if (RESOLVED.has(log.status)) {
      run = isConsecutive ? run + 1 : 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
    current = run
  }

  return { current, best }
}

/** Only the single day before the logical today may be filled in after the fact. */
export function canBackfill(
  logDate: ISODate,
  now: Date,
  cutoffHour: number,
  timeZone: string,
): boolean {
  return logDate === addDays(resolveActiveDate(now, cutoffHour, timeZone), -1)
}

/**
 * Grace tokens are per attempt: a reset starts the challenge over, tokens included.
 * Derived from the event log rather than a stored counter, which cannot drift.
 */
export function graceTokensRemaining(
  challenge: Challenge,
  events: readonly ChallengeEvent[],
): number {
  const spent = events.filter(
    (e) => e.type === 'grace_spent' && e.attemptNo === challenge.attemptNo,
  ).length
  return Math.max(0, challenge.graceTokensTotal - spent)
}
