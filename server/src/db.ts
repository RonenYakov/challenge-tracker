import postgres from 'postgres'
import { env } from './env.js'
import type {
  Challenge,
  ChallengeEvent,
  DayLog,
  Goal,
  GoalEntry,
  Profile,
  Task,
  TaskEntry,
} from '@ct/shared'

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  // Supabase's pooler does not support prepared statements in transaction mode.
  prepare: false,
})

/**
 * Postgres returns snake_case and numerics as strings. These mappers are the single
 * place that translation happens, so no route has to remember to do it.
 */

type Row = Record<string, unknown>

const num = (v: unknown): number => Number(v)
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
const str = (v: unknown): string => String(v)
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
/** `date` columns arrive as JS Dates; we want the plain 'YYYY-MM-DD' the logic layer speaks. */
const isoDate = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))
const isoOrNull = (v: unknown): string | null =>
  v === null || v === undefined ? null : iso(v)

export function toProfile(r: Row): Profile {
  return {
    id: str(r.id),
    email: str(r.email),
    displayName: strOrNull(r.display_name),
    createdAt: iso(r.created_at),
  }
}

export function toChallenge(r: Row): Challenge {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    name: str(r.name),
    startDate: isoDate(r.start_date),
    lengthDays: num(r.length_days),
    dayCutoffHour: num(r.day_cutoff_hour),
    timezone: str(r.timezone),
    graceTokensTotal: num(r.grace_tokens_total),
    attemptNo: num(r.attempt_no),
    status: r.status as Challenge['status'],
    createdAt: iso(r.created_at),
  }
}

export function toTask(r: Row): Task {
  return {
    id: str(r.id),
    challengeId: str(r.challenge_id),
    label: str(r.label),
    kind: r.kind as Task['kind'],
    targetValue: numOrNull(r.target_value),
    unit: strOrNull(r.unit),
    sortOrder: num(r.sort_order),
    isActive: Boolean(r.is_active),
    cue: strOrNull(r.cue),
  }
}

export function toDayLog(r: Row): DayLog {
  return {
    id: str(r.id),
    challengeId: str(r.challenge_id),
    logDate: isoDate(r.log_date),
    dayNumber: num(r.day_number),
    attemptNo: num(r.attempt_no),
    status: r.status as DayLog['status'],
    loggedLate: Boolean(r.logged_late),
    closedAt: isoOrNull(r.closed_at),
    note: strOrNull(r.note),
  }
}

export function toTaskEntry(r: Row): TaskEntry {
  return {
    id: str(r.id),
    dayLogId: str(r.day_log_id),
    taskId: str(r.task_id),
    value: num(r.value),
    timerStartedAt: isoOrNull(r.timer_started_at),
    updatedAt: iso(r.updated_at),
  }
}

export function toChallengeEvent(r: Row): ChallengeEvent {
  return {
    id: str(r.id),
    challengeId: str(r.challenge_id),
    type: r.type as ChallengeEvent['type'],
    dayNumber: num(r.day_number),
    attemptNo: num(r.attempt_no),
    occurredAt: iso(r.occurred_at),
  }
}

export function toGoal(r: Row): Goal {
  return {
    id: str(r.id),
    challengeId: str(r.challenge_id),
    label: str(r.label),
    unit: strOrNull(r.unit),
    startValue: num(r.start_value),
    targetValue: num(r.target_value),
    archived: Boolean(r.archived),
    createdAt: iso(r.created_at),
  }
}

export function toGoalEntry(r: Row): GoalEntry {
  return {
    id: str(r.id),
    goalId: str(r.goal_id),
    loggedOn: isoDate(r.logged_on),
    value: num(r.value),
    createdAt: iso(r.created_at),
  }
}
