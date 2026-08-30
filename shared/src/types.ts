/** A calendar date with no time component, always 'YYYY-MM-DD'. */
export type ISODate = string

export type TaskKind = 'check' | 'count' | 'timer'
export type DayStatus = 'pending' | 'complete' | 'incomplete' | 'graced'
export type ChallengeStatus = 'draft' | 'active' | 'completed' | 'abandoned'
export type ChallengeEventType = 'grace_spent' | 'reset'

export interface Profile {
  id: string
  email: string
  displayName: string | null
  createdAt: string
}

export interface Challenge {
  id: string
  userId: string
  name: string
  startDate: ISODate
  lengthDays: number
  dayCutoffHour: number
  /** IANA zone, e.g. 'Asia/Jerusalem'. Every date boundary is resolved in this zone. */
  timezone: string
  graceTokensTotal: number
  attemptNo: number
  status: ChallengeStatus
  createdAt: string
}

export interface Task {
  id: string
  challengeId: string
  label: string
  kind: TaskKind
  /** Required for 'count' and 'timer'; null for 'check'. Timer targets are in minutes. */
  targetValue: number | null
  unit: string | null
  sortOrder: number
  isActive: boolean
}

export interface DayLog {
  id: string
  challengeId: string
  logDate: ISODate
  dayNumber: number
  attemptNo: number
  status: DayStatus
  loggedLate: boolean
  closedAt: string | null
}

export interface TaskEntry {
  id: string
  dayLogId: string
  taskId: string
  value: number
  /** Set while a timer task is running; elapsed time is added to `value` on stop. */
  timerStartedAt: string | null
  updatedAt: string
}

export interface ChallengeEvent {
  id: string
  challengeId: string
  type: ChallengeEventType
  dayNumber: number
  attemptNo: number
  occurredAt: string
}

export interface Miss {
  date: ISODate
  dayNumber: number
}

export interface Streak {
  current: number
  best: number
}
