import { useQuery } from '@tanstack/react-query'
import { computeStreak } from '@ct/shared'
import { api } from '../lib/api'
import { Card, EmptyState, Skeleton, Stat } from '../components/ui'
import { Heatmap, HeatmapLegend } from '../components/Heatmap'

const MILESTONES = [7, 21, 30, 50]

export function Stats() {
  const today = useQuery({ queryKey: ['today'], queryFn: api.today })
  const challenge = today.data?.challenge

  const days = useQuery({
    queryKey: ['days', challenge?.id],
    queryFn: () => api.days(challenge!.id),
    enabled: Boolean(challenge),
  })
  const stats = useQuery({
    queryKey: ['stats', challenge?.id],
    queryFn: () => api.stats(challenge!.id),
    enabled: Boolean(challenge),
  })

  if (today.isPending) return <Skeleton className="h-64 w-full rounded-2xl" />
  if (!challenge) {
    return <EmptyState title="אין עדיין מה להראות" body="תתחיל אתגר והמספרים יתמלאו מעצמם." />
  }

  const allDays = days.data?.days ?? []
  const currentAttempt = allDays.filter((d) => d.attemptNo === challenge.attemptNo)
  const streak = computeStreak(currentAttempt, challenge.restWeekdays)
  const perfectDays = currentAttempt.filter((d) => d.status === 'complete').length
  const currentDay = stats.data?.currentDayNumber ?? 0

  // Milestones scale to the challenge's real length, plus its halfway point and its end.
  const milestones = [...new Set([...MILESTONES, Math.round(challenge.lengthDays / 2), challenge.lengthDays])]
    .filter((m) => m > 0 && m <= challenge.lengthDays)
    .sort((a, b) => a - b)

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Streak" value={streak.current} tone="gold" />
          <Stat label="Best" value={streak.best} />
          <Stat label="Perfect days" value={perfectDays} />
          <Stat
            label="Grace"
            value={stats.data?.graceTokensRemaining ?? '—'}
            suffix={`/ ${challenge.graceTokensTotal}`}
          />
        </div>
      </Card>

      <Card>
        <p className="eyebrow mb-3">The run</p>
        {days.data ? (
          <>
            <Heatmap challenge={challenge} days={allDays} today={today.data!.date!} />
            <div className="mt-3">
              <HeatmapLegend />
            </div>
          </>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </Card>

      <Card>
        <p className="eyebrow mb-3">Milestones</p>
        <div className="flex flex-wrap gap-2">
          {milestones.map((day) => {
            const reached = currentDay >= day
            return (
              <span
                key={day}
                className="tnum rounded-full border px-3 py-1 font-mono text-[12px] transition-colors duration-200"
                style={{
                  borderColor: reached ? 'var(--color-gold)' : 'var(--color-mist)',
                  color: reached ? 'var(--color-gold)' : 'var(--color-ink-muted)',
                  backgroundColor: reached ? 'hsl(42 78% 44% / 0.08)' : 'transparent',
                }}
              >
                {reached ? '★ ' : ''}
                יום {day}
              </span>
            )
          })}
        </div>
      </Card>

      <Card>
        <p className="eyebrow mb-1">Which rule is breaking you</p>
        <p className="mb-4 text-[13px] text-ink-muted">
          אחוז ההשלמה של כל כלל על פני הימים שנסגרו בניסיון הזה.
        </p>

        {stats.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="grid gap-3">
            {[...(stats.data?.taskRates ?? [])]
              .sort((a, b) => rate(a) - rate(b))
              .map((task) => (
                <li key={task.taskId}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <p className="truncate text-[14px]" style={{ unicodeBidi: 'plaintext', textAlign: 'start' }}>
                      {task.label}
                    </p>
                    <p className="tnum shrink-0 font-mono text-[12px] text-ink-muted">
                      {task.closedDays === 0 ? '—' : `${Math.round(rate(task) * 100)}%`}
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cream-dark">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${rate(task) * 100}%`,
                        backgroundColor:
                          rate(task) >= 0.9
                            ? 'var(--color-gold)'
                            : rate(task) >= 0.6
                              ? 'var(--color-orange)'
                              : 'var(--color-clay)',
                        transition: 'width 500ms var(--ease-out-soft)',
                      }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        )}

        {stats.data?.taskRates.every((t) => t.closedDays === 0) && (
          <p className="mt-3 text-[13px] text-ink-muted">
            אין עדיין מה להשוות. תחזור אחרי שהיום המלא הראשון שלך ייסגר.
          </p>
        )}
      </Card>
    </div>
  )
}

function rate(task: { closedDays: number; completedDays: number }): number {
  return task.closedDays === 0 ? 0 : task.completedDays / task.closedDays
}
