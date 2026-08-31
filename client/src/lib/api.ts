import { createClient } from '@supabase/supabase-js'
import type {
  AnchorSuggestion,
  Challenge,
  DayLog,
  EventOccurrence,
  Goal,
  GoalEntry,
  GoalProgress,
  ISODate,
  Miss,
  RoutineProfile,
  ScheduledEvent,
  Streak,
  Task,
  TaskEntry,
} from '@ct/shared'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/*
  A production build ALWAYS talks to its own origin, where the API is served at /api.
  Only development points somewhere else.

  This is deliberately not configurable in production. A local .env once travelled with
  a deploy and baked http://localhost:8787 into the live bundle, so the deployed site
  asked the developer's laptop for data and failed for everyone else. Hard-coding
  same-origin here makes that class of mistake impossible, whatever env files exist.
*/
const apiUrl = import.meta.env.DEV ? (import.meta.env.VITE_API_URL ?? '') : ''

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy client/.env.example to client/.env.',
  )
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Every call carries the current Supabase access token. `getSession` refreshes it when
 * it is close to expiring, so a tab left open overnight does not start 401-ing.
 */
/** Rejects rather than hanging forever, so a stall surfaces as an error the UI can show. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ApiError(0, `${label} timed out. Check your connection.`)), ms),
    ),
  ])
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // getSession refreshes an expiring token over the network, and that call can stall.
  // Unbounded, it means the request is never even sent and the screen spins forever.
  const { data } = await withTimeout(supabase.auth.getSession(), 10_000, 'Sign-in check')
  const token = data.session?.access_token
  if (!token) throw new ApiError(401, 'Not signed in')

  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(20_000),
      headers: {
        // Only declare a JSON body when there is one. Sending the header on a bodyless
        // POST or DELETE makes strict servers reject the request as malformed.
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    })
  } catch (error) {
    // A network failure or abort is not an HTTP status, so give it a readable message
    // rather than letting a raw "Failed to fetch" reach the screen.
    const reason = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'The server took too long to respond.'
      : 'Could not reach the server. Check your connection.'
    throw new ApiError(0, reason)
  }

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, (body as { error?: string }).error ?? 'Request failed')
  }
  return body as T
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const del = (path: string) => request<void>(path, { method: 'DELETE' })

export interface TodayResponse {
  challenge: Challenge | null
  tasks?: Task[]
  date?: ISODate
  dayNumber?: number
  daysRemaining?: number
  entries?: TaskEntry[]
  note?: string | null
  completion?: number
  streak?: Streak
  graceTokensRemaining?: number
  unresolvedMiss?: Miss | null
  missedYesterday?: boolean
  bestEver?: number
}

export interface DayWriteResponse {
  day: DayLog
  entries: TaskEntry[]
  completion: number
  streak: Streak
}

export interface TaskRate {
  taskId: string
  label: string
  kind: string
  targetValue: number | null
  unit: string | null
  closedDays: number
  completedDays: number
}

export interface StatsResponse {
  graceTokensRemaining: number
  graceTokensTotal: number
  currentDayNumber: number
  taskRates: TaskRate[]
}

export interface NewChallenge {
  name: string
  startDate: ISODate
  lengthDays: number
  dayCutoffHour: number
  timezone: string
  graceTokensTotal: number
}

export interface GoalWithProgress {
  goal: Goal
  entries: GoalEntry[]
  progress: GoalProgress
  daysRemaining: number
}

export interface NewGoal {
  label: string
  unit: string | null
  startValue: number
  targetValue: number
}

export interface NewEvent {
  title: string
  weekdays: number[]
  timeOfDay: string
  durationMinutes: number
}

export interface TaskAnchors {
  taskId: string
  label: string
  currentCue: string | null
  anchors: AnchorSuggestion[]
}

export interface NewTask {
  label: string
  kind: Task['kind']
  targetValue: number | null
  unit: string | null
  sortOrder: number
  cue: string | null
}

export const api = {
  today: () => get<TodayResponse>('/api/today'),

  challenges: () => get<{ challenges: Challenge[] }>('/api/challenges'),
  createChallenge: (body: NewChallenge) => post<{ challenge: Challenge }>('/api/challenges', body),
  updateChallenge: (id: string, body: Partial<NewChallenge>) =>
    patch<{ challenge: Challenge }>(`/api/challenges/${id}`, body),
  activateChallenge: (id: string) => post<{ challenge: Challenge }>(`/api/challenges/${id}/activate`),
  deleteChallenge: (id: string) => del(`/api/challenges/${id}`),
  resolveMiss: (id: string, action: 'grace' | 'reset') =>
    post<{ challenge: Challenge }>(`/api/challenges/${id}/resolve-miss`, { action }),

  tasks: (challengeId: string) => get<{ tasks: Task[] }>(`/api/challenges/${challengeId}/tasks`),
  createTask: (challengeId: string, body: NewTask) =>
    post<{ task: Task }>(`/api/challenges/${challengeId}/tasks`, body),
  updateTask: (taskId: string, body: Partial<NewTask>) =>
    patch<{ task: Task }>(`/api/tasks/${taskId}`, body),
  deleteTask: (taskId: string) => del(`/api/tasks/${taskId}`),

  days: (challengeId: string) => get<{ days: DayLog[] }>(`/api/challenges/${challengeId}/days`),
  day: (challengeId: string, date: ISODate) =>
    get<{ day: DayLog | null; tasks: Task[]; entries: TaskEntry[]; completion: number }>(
      `/api/challenges/${challengeId}/days/${date}`,
    ),
  stats: (challengeId: string) => get<StatsResponse>(`/api/challenges/${challengeId}/stats`),

  goals: (challengeId: string) =>
    get<{ goals: GoalWithProgress[] }>(`/api/challenges/${challengeId}/goals`),
  createGoal: (challengeId: string, body: NewGoal) =>
    post<{ goal: Goal }>(`/api/challenges/${challengeId}/goals`, body),
  deleteGoal: (goalId: string) => del(`/api/goals/${goalId}`),
  logGoalReading: (goalId: string, value: number) =>
    put<{ goal: Goal; entries: GoalEntry[]; progress: GoalProgress }>(
      `/api/goals/${goalId}/entries`,
      { value },
    ),

  events: (challengeId: string) =>
    get<{ events: ScheduledEvent[]; upcoming: EventOccurrence[] }>(
      `/api/challenges/${challengeId}/events`,
    ),
  createEvent: (challengeId: string, body: NewEvent) =>
    post<{ event: ScheduledEvent }>(`/api/challenges/${challengeId}/events`, body),
  deleteEvent: (eventId: string) => del(`/api/events/${eventId}`),

  calendarLink: () => get<{ token: string | null }>('/api/calendar-link'),
  rotateCalendarLink: () => post<{ token: string }>('/api/calendar-link/rotate'),

  routine: () => get<{ routine: RoutineProfile | null }>('/api/routine'),
  saveRoutine: (body: Omit<RoutineProfile, 'updatedAt'>) =>
    put<{ routine: RoutineProfile }>('/api/routine', body),
  anchorSuggestions: (challengeId: string) =>
    get<{ routine: RoutineProfile | null; suggestions: TaskAnchors[] }>(
      `/api/challenges/${challengeId}/anchor-suggestions`,
    ),

  saveNote: (date: ISODate, note: string | null) =>
    put<{ day: DayLog }>(`/api/days/${date}/note`, { note }),

  setEntry: (date: ISODate, taskId: string, value: number) =>
    put<DayWriteResponse>(`/api/days/${date}/entries/${taskId}`, { value }),
  startTimer: (date: ISODate, taskId: string) =>
    post<DayWriteResponse>(`/api/days/${date}/timer/${taskId}/start`),
  stopTimer: (date: ISODate, taskId: string) =>
    post<DayWriteResponse>(`/api/days/${date}/timer/${taskId}/stop`),
}
