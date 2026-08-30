import { createClient } from '@supabase/supabase-js'
import type {
  Challenge,
  DayLog,
  ISODate,
  Miss,
  Streak,
  Task,
  TaskEntry,
} from '@ct/shared'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const apiUrl = import.meta.env.VITE_API_URL

if (!url || !key || !apiUrl) {
  throw new Error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, or VITE_API_URL. Copy client/.env.example to client/.env.')
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
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError(401, 'Not signed in')

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      // Only declare a JSON body when there is one. Sending the header on a bodyless
      // POST or DELETE makes strict servers reject the request as malformed.
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

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
  completion?: number
  streak?: Streak
  graceTokensRemaining?: number
  unresolvedMiss?: Miss | null
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

export interface NewTask {
  label: string
  kind: Task['kind']
  targetValue: number | null
  unit: string | null
  sortOrder: number
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

  setEntry: (date: ISODate, taskId: string, value: number) =>
    put<DayWriteResponse>(`/api/days/${date}/entries/${taskId}`, { value }),
  startTimer: (date: ISODate, taskId: string) =>
    post<DayWriteResponse>(`/api/days/${date}/timer/${taskId}/start`),
  stopTimer: (date: ISODate, taskId: string) =>
    post<DayWriteResponse>(`/api/days/${date}/timer/${taskId}/stop`),
}
