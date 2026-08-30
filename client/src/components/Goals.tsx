import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type GoalWithProgress } from '../lib/api'
import { Button, Card, Field, Input, Skeleton } from './ui'

/**
 * End-of-period outcomes: "lose 3kg", "read 12 books". Kept visually distinct from the
 * daily rules because they behave differently: a goal never touches the streak and
 * never causes a reset. Missing your pace is information, not failure.
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
    mutationFn: (body: Parameters<typeof api.createGoal>[1]) => api.createGoal(challengeId, body),
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
                finish the thing you keep putting off.
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
  const [value, setValue] = useState('')

  const log = useMutation({
    mutationFn: (v: number) => api.logGoalReading(goal.id, v),
    onSuccess: () => {
      setValue('')
      onChanged()
    },
  })

  const remove = useMutation({ mutationFn: () => api.deleteGoal(goal.id), onSuccess: onChanged })

  const done = progress.completion >= 1
  const unit = goal.unit ? ` ${goal.unit}` : ''

  // Gold when finished, orange when behind, ink when simply on track. Behind is not
  // painted red: a goal is not a failure state, and a scary colour every weigh-in is
  // how people stop weighing in.
  const tone = done ? 'var(--color-gold)' : progress.onPace ? 'var(--color-ink)' : 'var(--color-orange)'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-[15px]" style={{ unicodeBidi: 'plaintext', textAlign: 'left' }}>
          {goal.label}
        </p>
        <p className="tnum shrink-0 font-mono text-[12px]" style={{ color: tone }}>
          {formatNumber(progress.current)}
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
        {!done && (
          <span
            className="absolute top-0 h-full w-px bg-ink-muted/50"
            style={{
              left: `${Math.min(100, Math.max(0, ((progress.expected - goal.startValue) / (goal.targetValue - goal.startValue)) * 100))}%`,
            }}
            title="Where you would be on a straight line to the target"
          />
        )}
      </div>

      <p className="tnum mt-1 font-mono text-[11px] text-ink-muted">
        {done
          ? `Target reached · ${formatNumber(goal.targetValue)}${unit}`
          : `${formatNumber(progress.remaining)}${unit} to go · ${progress.onPace ? 'on pace' : 'behind pace'} · ${daysRemaining} days left`}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Input
          type="number"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Log today${unit ? ` (${goal.unit})` : ''}`}
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
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove the goal "${goal.label}"? Your logged readings are kept.`)) {
              remove.mutate()
            }
          }}
          className="touch px-1 text-[12px] text-ink-muted underline hover:text-ink"
        >
          Remove
        </button>
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
  onSubmit: (body: { label: string; unit: string | null; startValue: number; targetValue: number }) => void
  onCancel: () => void
  pending: boolean
  error: Error | null
}) {
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState('')
  const [startValue, setStartValue] = useState('')
  const [targetValue, setTargetValue] = useState('')

  return (
    <form
      className="mt-4 border-t border-mist/70 pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          label: label.trim(),
          unit: unit.trim() || null,
          startValue: Number(startValue),
          targetValue: Number(targetValue),
        })
      }}
    >
      <Field label="Goal">
        <Input
          dir="auto"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Lose 3kg"
        />
      </Field>

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
