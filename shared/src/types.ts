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
  /**
   * Weekdays with nothing due, 0 = Sunday through 6 = Saturday. `[6]` is Shabbat.
   * A rest day is never required, never breaks a streak, and cannot be logged, so
   * `lengthDays` counts days of actual work: sixty days with Saturdays off runs about
   * seventy calendar days and is still sixty real days.
   */
  restWeekdays: number[]
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
  /**
   * Optional implementation intention: when and where this happens.
   * "After I brush my teeth", "6am, kitchen". Specifying the cue is one of the few
   * habit techniques with replicated effects, and it is the cheapest to offer.
   */
  cue: string | null
  /**
   * How this rule sits in the day.
   * `unset`    not decided yet
   * `anytime`  spread across the day, no single moment (drinking water)
   * `fixed`    happens at a set clock time (LeetCode at 10:00)
   * `anchored` attached to something else you already do (after brushing teeth)
   */
  scheduleMode: TaskScheduleMode
  /** 'HH:MM', set only when scheduleMode is 'fixed'. */
  scheduledTime: string | null
}

export type TaskScheduleMode = 'unset' | 'anytime' | 'fixed' | 'anchored'

export interface DayLog {
  id: string
  challengeId: string
  logDate: ISODate
  dayNumber: number
  attemptNo: number
  status: DayStatus
  loggedLate: boolean
  closedAt: string | null
  /** Optional journal entry for the day. */
  note: string | null
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

/**
 * An outcome for the whole challenge, tracked by a number moving from a starting
 * reading toward a target by the final day. Distinct from a daily task: a goal never
 * affects the streak and can never trigger a reset.
 */
export type GoalKind = 'number' | 'milestone'

export interface Goal {
  id: string
  challengeId: string
  label: string
  kind: GoalKind
  unit: string | null
  /** Both null for a milestone, both set for a numeric goal. */
  startValue: number | null
  targetValue: number | null
  /** Set only when a milestone has been ticked. */
  completedOn: ISODate | null
  archived: boolean
  createdAt: string
}

export interface GoalEntry {
  id: string
  goalId: string
  loggedOn: ISODate
  value: number
  createdAt: string
}

export interface GoalProgress {
  /** The most recent reading, or the start value. Null for a milestone. */
  current: number | null
  /** Where a straight line from start to target would put you today. Null for a milestone. */
  expected: number | null
  /** 0..1 of the distance covered. A milestone is simply 0 or 1. */
  completion: number
  /**
   * Whether you are ahead of the reference line. Always true for a milestone: there is
   * no line to be behind, and inventing one would nag about something undated.
   */
  onPace: boolean
  /** How much is still left to move. Null for a milestone. */
  remaining: number | null
  /** Null for a milestone, which moves in no direction. */
  direction: 'up' | 'down' | null
}

/**
 * A weekly recurring event that supports the challenge without being scored by it.
 * Missing one never affects the streak; that is what daily tasks are for.
 */
export interface ScheduledEvent {
  id: string
  challengeId: string
  title: string
  /** 0 = Sunday through 6 = Saturday, matching Date#getUTCDay. */
  weekdays: number[]
  /** 'HH:MM' in the challenge's timezone. */
  timeOfDay: string
  durationMinutes: number
  googleEventId: string | null
  syncedAt: string | null
}

export interface EventOccurrence {
  event: ScheduledEvent
  date: ISODate
}

/**
 * A few facts about the shape of the user's day, used only to propose candidate
 * anchors for habit stacking. Every field is optional; the suggestions simply get
 * thinner the less is known.
 */
export interface RoutineProfile {
  /** 'HH:MM', all optional. */
  wakeTime: string | null
  workStart: string | null
  workEnd: string | null
  sleepTime: string | null
  hasKids: boolean
  updatedAt: string
}

export interface AnchorSuggestion {
  /** The cue text, ready to be accepted or edited. */
  cue: string
  /** Roughly when it lands, for ordering. Null when the moment has no clock time. */
  at: string | null
}
