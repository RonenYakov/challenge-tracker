import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Task, TaskKind } from '@ct/shared'
import { api, type NewTask } from '../lib/api'
import { Button, Card, Field, Input, Skeleton } from '../components/ui'

const KIND_LABEL: Record<TaskKind, string> = {
  check: 'Done / not done',
  count: 'Count to a target',
  timer: 'Timed',
}

export function ChallengeEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const challenge = useQuery({
    queryKey: ['challenges'],
    queryFn: api.challenges,
    select: (data) => data.challenges.find((c) => c.id === id),
  })
  const tasks = useQuery({ queryKey: ['tasks', id], queryFn: () => api.tasks(id) })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks', id] })
    void queryClient.invalidateQueries({ queryKey: ['challenges'] })
    void queryClient.invalidateQueries({ queryKey: ['today'] })
  }

  const addTask = useMutation({ mutationFn: (body: NewTask) => api.createTask(id, body), onSuccess: refresh })
  const removeTask = useMutation({ mutationFn: api.deleteTask, onSuccess: refresh })
  const activate = useMutation({
    mutationFn: () => api.activateChallenge(id),
    onSuccess: () => {
      refresh()
      navigate('/')
    },
  })
  const remove = useMutation({
    mutationFn: () => api.deleteChallenge(id),
    onSuccess: () => {
      refresh()
      navigate('/challenges')
    },
  })

  if (challenge.isPending || tasks.isPending) {
    return <Skeleton className="h-64 w-full rounded-2xl" />
  }
  if (!challenge.data) return <p className="text-sm text-ink-muted">Challenge not found.</p>

  const c = challenge.data
  const activeTasks = (tasks.data?.tasks ?? []).filter((t) => t.isActive)
  const isRunning = c.status === 'active'

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">{isRunning ? 'Running' : 'Setup'}</p>
      <h1 dir="auto" className="mt-1 text-2xl">
        {c.name}
      </h1>
      <p className="tnum mt-1 font-mono text-[12px] text-ink-muted">
        {c.lengthDays} days · from {c.startDate} · day ends {String(c.dayCutoffHour).padStart(2, '0')}:00 ·{' '}
        {c.graceTokensTotal} grace · {c.timezone}
      </p>

      <Card className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">The rules</p>
          <p className="tnum font-mono text-[12px] text-ink-muted">{activeTasks.length}</p>
        </div>

        <ul className="grid gap-2">
          {activeTasks.map((task) => (
            <TaskLine
              key={task.id}
              task={task}
              onRemove={() => removeTask.mutate(task.id)}
              removing={removeTask.isPending}
            />
          ))}
        </ul>

        {activeTasks.length === 0 && (
          <p className="text-sm text-ink-muted">No rules yet. Add the first one below.</p>
        )}

        <AddTaskForm
          pending={addTask.isPending}
          error={addTask.error as Error | null}
          nextSortOrder={activeTasks.length}
          onSubmit={(body) => addTask.mutate(body)}
        />
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!isRunning && (
          <Button
            variant="primary"
            disabled={activeTasks.length === 0 || activate.isPending}
            onClick={() => activate.mutate()}
          >
            Start this challenge
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate('/challenges')}>
          Back
        </Button>
        <Button
          variant="danger"
          className="ml-auto"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm('Delete this challenge and everything logged against it?')) remove.mutate()
          }}
        >
          Delete
        </Button>
      </div>

      {activate.isError && (
        <p className="shake mt-3 text-sm" style={{ color: 'var(--color-clay)' }}>
          {(activate.error as Error).message}
        </p>
      )}
    </div>
  )
}

function TaskLine({
  task,
  onRemove,
  removing,
}: {
  task: Task
  onRemove: () => void
  removing: boolean
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-mist/60 bg-cream px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-[15px]">
          {task.label}
        </p>
        <p className="tnum mt-0.5 font-mono text-[11px] text-ink-muted">
          {task.kind === 'check'
            ? KIND_LABEL.check
            : `${task.targetValue} ${task.unit ?? ''} · ${KIND_LABEL[task.kind]}`}
        </p>
      </div>
      <Button variant="ghost" disabled={removing} onClick={onRemove} className="px-2 text-[12px]">
        Remove
      </Button>
    </li>
  )
}

/**
 * A new rule is a checkbox until you say otherwise. The target and unit fields only
 * appear once you pick a type that needs them, so the common case is one field and Enter.
 */
function AddTaskForm({
  onSubmit,
  pending,
  error,
  nextSortOrder,
}: {
  onSubmit: (body: NewTask) => void
  pending: boolean
  error: Error | null
  nextSortOrder: number
}) {
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<TaskKind>('check')
  const [targetValue, setTargetValue] = useState('')
  const [unit, setUnit] = useState('')

  const needsTarget = kind !== 'check'

  return (
    <form
      className="mt-4 border-t border-mist/70 pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          label: label.trim(),
          kind,
          targetValue: needsTarget ? Number(targetValue) : null,
          unit: needsTarget ? unit.trim() || (kind === 'timer' ? 'min' : null) : null,
          sortOrder: nextSortOrder,
        })
        setLabel('')
        setTargetValue('')
        setUnit('')
        setKind('check')
      }}
    >
      <Field label="Add a rule">
        <Input
          dir="auto"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Read 10 pages"
        />
      </Field>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(KIND_LABEL) as TaskKind[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className="press rounded-full border px-3 py-1 text-[12px]"
            style={{
              borderColor: kind === option ? 'var(--color-orange)' : 'var(--color-mist)',
              color: kind === option ? 'var(--color-orange)' : 'var(--color-ink-muted)',
              backgroundColor: kind === option ? 'hsl(18 66% 50% / 0.07)' : 'transparent',
            }}
          >
            {KIND_LABEL[option]}
          </button>
        ))}
      </div>

      {needsTarget && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Target">
            <Input
              type="number"
              min={0.1}
              step="any"
              required
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={kind === 'timer' ? '45' : '3'}
            />
          </Field>
          <Field label="Unit">
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={kind === 'timer' ? 'min' : 'L'}
            />
          </Field>
        </div>
      )}

      {error && (
        <p className="shake mt-3 text-sm" style={{ color: 'var(--color-clay)' }}>
          {error.message}
        </p>
      )}

      <Button type="submit" className="mt-3" loading={pending}>
        Add rule
      </Button>
    </form>
  )
}
