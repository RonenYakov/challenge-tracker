import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import type { TaskEntry } from '@ct/shared'
import { api, type DayWriteResponse, type TodayResponse } from '../lib/api'
import { Ring } from '../components/Ring'
import { TaskRow } from '../components/TaskRow'
import { Heatmap, HeatmapLegend } from '../components/Heatmap'
import { Button, Card, EmptyState, Skeleton, Stat } from '../components/ui'
import { Reckoning } from '../components/Reckoning'

export function Today() {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({ queryKey: ['today'], queryFn: api.today })

  const days = useQuery({
    queryKey: ['days', data?.challenge?.id],
    queryFn: () => api.days(data!.challenge!.id),
    enabled: Boolean(data?.challenge),
  })

  /**
   * Optimistic writes. The tap lands instantly and the server's answer replaces it a
   * moment later; if the request fails the previous state is put back.
   */
  const applyWrite = (result: DayWriteResponse) => {
    queryClient.setQueryData<TodayResponse>(['today'], (old) =>
      old ? { ...old, entries: result.entries, completion: result.completion, streak: result.streak } : old,
    )
    void queryClient.invalidateQueries({ queryKey: ['days'] })
  }

  const mutate = useMutation({
    mutationFn: (action: () => Promise<DayWriteResponse>) => action(),
    onSuccess: applyWrite,
    onError: () => void queryClient.invalidateQueries({ queryKey: ['today'] }),
  })

  const setEntryOptimistically = (taskId: string, value: number) => {
    queryClient.setQueryData<TodayResponse>(['today'], (old) => {
      if (!old?.entries || !old.tasks) return old
      const entries: TaskEntry[] = old.entries.some((e) => e.taskId === taskId)
        ? old.entries.map((e) => (e.taskId === taskId ? { ...e, value } : e))
        : [
            ...old.entries,
            { id: `optimistic-${taskId}`, dayLogId: '', taskId, value, timerStartedAt: null, updatedAt: '' },
          ]
      const done = old.tasks.filter(
        (t) =>
          (entries.find((e) => e.taskId === t.id)?.value ?? 0) >=
          (t.kind === 'check' ? 1 : (t.targetValue ?? 1)),
      ).length
      return { ...old, entries, completion: old.tasks.length ? done / old.tasks.length : 0 }
    })
  }

  const handleSetValue = (taskId: string, value: number) => {
    setEntryOptimistically(taskId, value)
    mutate.mutate(() => api.setEntry(data!.date!, taskId, value))
  }

  const tasks = data?.tasks ?? []
  const entries = data?.entries ?? []
  const completion = data?.completion ?? 0

  // Number keys toggle tasks. Four seconds to log a day, without leaving the keyboard.
  useEffect(() => {
    if (!data?.challenge || !data.date) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      const index = Number(event.key) - 1
      const task = tasks[index]
      if (!Number.isInteger(index) || index < 0 || !task || task.kind === 'timer') return

      const goal = task.kind === 'check' ? 1 : (task.targetValue ?? 1)
      const current = entries.find((e) => e.taskId === task.id)?.value ?? 0
      handleSetValue(task.id, current >= goal ? 0 : goal)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useCelebrateOnce(completion === 1 && tasks.length > 0, data?.date)

  if (isPending) return <TodaySkeleton />

  if (!data?.challenge) {
    return (
      <EmptyState
        title="No challenge running"
        body="Set your rules, your length, and how much grace you get. Then start day one."
        action={
          <Link to="/challenges">
            <Button variant="primary">Create a challenge</Button>
          </Link>
        }
      />
    )
  }

  const { challenge, unresolvedMiss, streak, graceTokensRemaining, dayNumber, daysRemaining } = data

  // The challenge is scheduled but its first day has not begun. With a 4am cutoff this
  // is also true late at night on the eve of day 1, which is why it is a real state and
  // not just a same-day edge case.
  if ((dayNumber ?? 0) < 1) {
    const startsIn = 1 - (dayNumber ?? 0)
    return (
      <EmptyState
        title={`${challenge.name} starts ${startsIn === 1 ? 'tomorrow' : `in ${startsIn} days`}`}
        body={`Day 1 is ${challenge.startDate}. Nothing to log until then, and the day rolls over at ${String(challenge.dayCutoffHour).padStart(2, '0')}:00.`}
        action={
          <Link to={`/challenges/${challenge.id}`}>
            <Button variant="secondary">Review the rules</Button>
          </Link>
        }
      />
    )
  }

  if (unresolvedMiss) {
    return (
      <Reckoning
        challenge={challenge}
        miss={unresolvedMiss}
        tokensLeft={graceTokensRemaining ?? 0}
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Day {String(dayNumber).padStart(2, '0')}</p>
            <h1 dir="auto" className="mt-1 truncate text-2xl">
              {challenge.name}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {daysRemaining === 0 ? 'Final day' : `${daysRemaining} days left`} · of{' '}
              {challenge.lengthDays}
            </p>
          </div>
          <Ring value={completion}>
            <div>
              <p className="tnum font-mono text-2xl leading-none">
                {Math.round(completion * 100)}
                <span className="text-sm text-ink-muted">%</span>
              </p>
            </div>
          </Ring>
        </div>

        <ul className="mt-5 grid gap-2">
          {tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              index={index}
              entry={entries.find((e) => e.taskId === task.id)}
              onSetValue={(value) => handleSetValue(task.id, value)}
              onStartTimer={() => mutate.mutate(() => api.startTimer(data.date!, task.id))}
              onStopTimer={() => mutate.mutate(() => api.stopTimer(data.date!, task.id))}
            />
          ))}
        </ul>

        {tasks.length === 0 && (
          <p className="mt-4 text-sm text-ink-muted">
            This challenge has no tasks yet.{' '}
            <Link to={`/challenges/${challenge.id}`} className="underline">
              Add some
            </Link>
            .
          </p>
        )}
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Streak" value={streak?.current ?? 0} tone="gold" />
            <Stat label="Best" value={streak?.best ?? 0} />
            <Stat
              label="Grace"
              value={graceTokensRemaining ?? 0}
              suffix={`/ ${challenge.graceTokensTotal}`}
              tone={graceTokensRemaining === 0 ? 'muted' : 'ink'}
            />
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">The run</p>
            <Link to="/stats" className="text-[12px] text-ink-muted underline hover:text-ink">
              Stats
            </Link>
          </div>
          {days.data ? (
            <>
              <Heatmap challenge={challenge} days={days.data.days} today={data.date!} />
              <div className="mt-3">
                <HeatmapLegend />
              </div>
            </>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Card>
      </div>
    </div>
  )
}

/**
 * Confetti fires once, on the transition into a complete day, and is remembered per date
 * so a refresh does not re-celebrate. A celebration you can trigger twice is not one.
 */
function useCelebrateOnce(isComplete: boolean, date: string | undefined) {
  const previous = useRef<boolean | null>(null)

  useEffect(() => {
    if (!date) return
    const key = `celebrated:${date}`
    const wasComplete = previous.current
    previous.current = isComplete

    if (!isComplete || wasComplete === null || wasComplete) return
    if (localStorage.getItem(key)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    localStorage.setItem(key, '1')
    confetti({
      particleCount: 90,
      spread: 68,
      startVelocity: 34,
      scalar: 0.9,
      origin: { y: 0.35 },
      colors: ['#C98A1F', '#E0B44E', '#C4531F', '#F7F3E9'],
    })
  }, [isComplete, date])
}

function TodaySkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <div className="flex items-start justify-between">
          <div className="w-full max-w-xs">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-48" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
          <Skeleton className="h-[132px] w-[132px] rounded-full" />
        </div>
        <div className="mt-5 grid gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-xl" />
          ))}
        </div>
      </Card>
      <div className="grid content-start gap-4">
        <Skeleton className="h-[92px] w-full rounded-2xl" />
        <Skeleton className="h-[180px] w-full rounded-2xl" />
      </div>
    </div>
  )
}
