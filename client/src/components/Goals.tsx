import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type GoalWithProgress, type NewGoal } from '../lib/api'
import { Button, Card, Field, Input, Skeleton } from './ui'

/**
 * End-of-period outcomes, in two shapes.
 *
 * A numeric goal moves from a start to a target and is tracked by readings: lose 3kg,
 * read 12 books. A milestone is done or not done: ship to production, finish the
 * project. Forcing the second into a start/target pair would be arithmetic pretending
 * to be progress.
 *
 * Neither ever touches the streak. Missing your pace is information, not failure.
 */
export function Goals({ challengeId }: { challengeId: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  const { data, isPending } = useQuery({
    queryKey: ['goals', challengeId],
    queryFn: () => api.goals(challengeId),
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['goals', challengeId] })

  const create = useMutation({
    mutationFn: (body: NewGoal) => api.createGoal(challengeId, body),
    onSuccess: () => {
      refresh()
      setAdding(false)
    },
  })

  const goals = data?.goals ?? []

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="eyebrow">By the end</p>
        {!adding && goals.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="touch text-[12px] text-ink-muted underline hover:text-ink"
          >
            Add
          </button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="grid gap-4">
          {goals.map((g) => (
            <GoalRow key={g.goal.id} item={g} onChanged={refresh} />
          ))}

          {goals.length === 0 && !adding && (
            <div>
              <p className="text-[13px] text-ink-muted">
                Nothing set for the end of this challenge yet. Lose 3kg, read 12 books,
                or finish the thing you keep putting off.
              </p>
              <Button variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
                Set a goal
              </Button>
            </div>
          )}
        </div>
      )}

      {adding && (
        <NewGoalForm
          pending={create.isPending}
          error={create.error as Error | null}
          onCancel={() => setAdding(false)}
          onSubmit={(body) => create.mutate(body)}
        />
      )}
    </Card>
  )
}

function GoalRow({ item, onChanged }: { item: GoalWithProgress; onChanged: () => void }) {
  const { goal, progress, daysRemaining } = item
  const remove = useMutation({ mutationFn: () => api.deleteGoal(goal.id), onSuccess: onChanged })
  const done = progress.completion >= 1

  return (
    <div>
      {goal.kind === 'milestone' ? (
        <MilestoneRow item={item} onChanged={onChanged} />
      ) : (
        <NumberRow item={item} onChanged={onChanged} />
      )}

      <div className="mt-1.5 flex items-center gap-3">
        {goal.kind === 'milestone' && !done && (
          <span className="tnum font-mono text-[11px] text-ink-muted">
            {daysRemaining} days left
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove the goal "${goal.label}"? Anything logged is kept.`)) remove.mutate()
          }}
          className="touch text-[11px] text-ink-muted underline hover:text-ink"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

/** Done or not done. One tap, and it can be untapped if it was premature. */
function MilestoneRow({ item, onChanged }: { item: GoalWithProgress; onChanged: () => void }) {
  const { goal, progress } = item
  const done = progress.completion >= 1

  const toggle = useMutation({
    mutationFn: () => api.completeGoal(goal.id, !done),
    onSuccess: onChanged,
  })

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={goal.label}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate()}
        className="press touch grid h-7 w-7 shrink-0 place-items-center rounded-md border disabled:opacity-40"
        style={{
          borderColor: done ? 'var(--color-gold)' : 'var(--color-mist)',
          backgroundColor: done ? 'var(--color-gold)' : 'transparent',
          transition: 'background-color 160ms var(--ease-spring), border-color 160ms ease',
        }}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M4.5 10.5l3.6 3.6L15.5 6.7"
            stroke="var(--color-paper)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={done ? 0 : 1}
            style={{ transition: 'stroke-dashoffset 260ms var(--ease-out-soft) 40ms' }}
          />
        </svg>
      </button>

      <p
        className="min-w-0 flex-1 truncate text-[15px]"
        style={{
          unicodeBidi: 'plaintext',
          textAlign: 'left',
          color: done ? 'var(--color-ink-muted)' : 'var(--color-ink)',
          textDecorationLine: done ? 'line-through' : 'none',
          textDecorationColor: 'var(--color-gold)',
        }}
      >
        {goal.label}
      </p>
    </div>
  )
}

/** A number moving toward a target, with a reference line to compare against. */
function NumberRow({ item, onChanged }: { item: GoalWithProgress; onChanged: () => void }) {
  const { goal, progress, daysRemaining } = item
  const [value, setValue] = useState('')

  const log = useMutation({
    mutationFn: (v: number) => api.logGoalReading(goal.id, v),
    onSuccess: () => {
      setValue('')
      onChanged()
    },
  })

  const done = progress.completion >= 1
  const unit = goal.unit ? ` ${goal.unit}` : ''
  const start = goal.startValue ?? 0
  const target = goal.targetValue ?? 0

  // Gold when finished, orange when behind, ink when on track. Behind is not red: a
  // goal is not a failure state, and a warning colour at every weigh-in is how people
  // stop weighing in.
  const tone = done ? 'var(--color-gold)' : progress.onPace ? 'var(--color-ink)' : 'var(--color-orange)'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-[15px]" style={{ unicodeBidi: 'plaintext', textAlign: 'left' }}>
          {goal.label}
        </p>
        <p className="tnum shrink-0 font-mono text-[12px]" style={{ color: tone }}>
          {formatNumber(progress.current ?? start)}
          {unit}
        </p>
      </div>

      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-dark">
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress.completion * 100}%`,
            backgroundColor: tone,
            transition: 'width 500ms var(--ease-out-soft), background-color 300ms ease',
          }}
        />
        {/* Where a straight line to the target would have you today. */}
        {!done && progress.expected !== null && target !== start && (
          <span
            className="absolute top-0 h-full w-px bg-ink-muted/50"
            style={{
              left: `${Math.min(100, Math.max(0, ((progress.expected - start) / (target - start)) * 100))}%`,
            }}
            title="Where you would be on a straight line to the target"
          />
        )}
      </div>

      <p className="tnum mt-1 font-mono text-[11px] text-ink-muted">
        {done
          ? `Target reached · ${formatNumber(target)}${unit}`
          : `${formatNumber(progress.remaining ?? 0)}${unit} to go · ${progress.onPace ? 'on pace' : 'behind pace'} · ${daysRemaining} days left`}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Input
          type="number"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Log today${goal.unit ? ` (${goal.unit})` : ''}`}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value !== '') log.mutate(Number(value))
          }}
        />
        <Button
          variant="secondary"
          disabled={value === '' || log.isPending}
          onClick={() => log.mutate(Number(value))}
        >
          Log
        </Button>
      </div>

      {log.isError && (
        <p className="shake mt-1 text-[12px]" style={{ color: 'var(--color-clay)' }}>
          {(log.error as Error).message}
        </p>
      )}
    </div>
  )
}

function NewGoalForm({
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  onSubmit: (body: NewGoal) => void
  onCancel: () => void
  pending: boolean
  error: Error | null
}) {
  const [kind, setKind] = useState<'number' | 'milestone'>('number')
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState('')
  const [startValue, setStartValue] = useState('')
  const [targetValue, setTargetValue] = useState('')

  return (
    <form
      className="mt-4 border-t border-mist/70 pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(
          kind === 'number'
            ? {
                kind: 'number',
                label: label.trim(),
                unit: unit.trim() || null,
                startValue: Number(startValue),
                targetValue: Number(targetValue),
              }
            : { kind: 'milestone', label: label.trim() },
        )
      }}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            ['number', 'A number to move'],
            ['milestone', 'Something to finish'],
          ] as const
        ).map(([option, text]) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className="press touch rounded-full border px-3 py-2 text-[12px] sm:py-1"
            style={{
              borderColor: kind === option ? 'var(--color-orange)' : 'var(--color-mist)',
              color: kind === option ? 'var(--color-orange)' : 'var(--color-ink-muted)',
              backgroundColor: kind === option ? 'hsl(18 66% 50% / 0.07)' : 'transparent',
            }}
          >
            {text}
          </button>
        ))}
      </div>

      <Field label="Goal">
        <Input
          dir="auto"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === 'number' ? 'Lose 3kg' : 'Ship the project to production'}
        />
      </Field>

      {kind === 'number' && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Field label="Now">
            <Input
              type="number"
              step="any"
              required
              inputMode="decimal"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
              placeholder="80"
            />
          </Field>
          <Field label="Target">
            <Input
              type="number"
              step="any"
              required
              inputMode="decimal"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="77"
            />
          </Field>
          <Field label="Unit">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" />
          </Field>
        </div>
      )}

      {kind === 'milestone' && (
        <p className="mt-2 text-[12px] text-ink-muted">
          No numbers to track. Tick it off when it is done, any time before the challenge ends.
        </p>
      )}

      {error && (
        <p className="shake mt-3 text-sm" style={{ color: 'var(--color-clay)' }}>
          {error.message}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="secondary" loading={pending}>
          {pending ? 'Saving…' : 'Add goal'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
