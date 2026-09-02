import { useEffect, useState } from 'react'
import type { Task, TaskEntry } from '@ct/shared'

interface TaskRowProps {
  task: Task
  entry: TaskEntry | undefined
  index: number
  disabled?: boolean
  onSetValue: (value: number) => void
  onStartTimer: () => void
  onStopTimer: () => void
}

const target = (task: Task) => (task.kind === 'check' ? 1 : (task.targetValue ?? 1))

/** Minutes elapsed on a running timer, recomputed every second while it runs. */
function useRunningMinutes(startedAt: string | null): number {
  const [minutes, setMinutes] = useState(0)

  useEffect(() => {
    if (!startedAt) {
      setMinutes(0)
      return
    }
    const started = new Date(startedAt).getTime()
    const tick = () => setMinutes((Date.now() - started) / 60000)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return minutes
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function TaskRow({
  task,
  entry,
  index,
  disabled,
  onSetValue,
  onStartTimer,
  onStopTimer,
}: TaskRowProps) {
  const running = useRunningMinutes(entry?.timerStartedAt ?? null)
  const stored = entry?.value ?? 0
  const value = task.kind === 'timer' ? stored + running : stored
  const goal = target(task)
  const done = value >= goal
  const isRunning = Boolean(entry?.timerStartedAt)

  return (
    <li
      className="group flex items-center gap-3 rounded-xl border border-mist/60 bg-paper px-3 py-2 shadow-sm transition-colors duration-150 sm:py-2.5"
      style={{ borderColor: done ? 'var(--color-gold-dim)' : undefined }}
    >
      <Checkbox
        done={done}
        disabled={disabled}
        label={task.label}
        onClick={() => onSetValue(done ? 0 : goal)}
      />

      <div className="min-w-0 flex-1">
        {/*
          `plaintext` orders each label by its own script, so an English rule reads
          left-to-right inside a right-to-left list. Alignment stays on `start`, which is
          the same edge as the checkbox, so a mixed list still scans down one column.
          Full `dir="auto"` would flip alignment per row and break that column.
        */}
        <p
          className="truncate text-[15px] transition-colors duration-200"
          style={{
            unicodeBidi: 'plaintext',
            textAlign: 'start',
            color: done ? 'var(--color-ink-muted)' : 'var(--color-ink)',
            textDecorationLine: done ? 'line-through' : 'none',
            textDecorationColor: 'var(--color-gold)',
          }}
        >
          {task.label}
        </p>
        {task.kind !== 'check' && (
          <p className="tnum mt-0.5 font-mono text-[11px] text-ink-muted">
            {formatValue(value)} / {formatValue(goal)} {task.unit ?? ''}
          </p>
        )}
        {/* The cue is the trigger you chose. Showing it turns the list into a plan. */}
        {task.cue && !done && (
          <p
            className="mt-0.5 truncate text-[11px] text-ink-muted"
            style={{ unicodeBidi: 'plaintext', textAlign: 'start' }}
          >
            {task.cue}
          </p>
        )}
      </div>

      {task.kind === 'count' && (
        <Stepper
          disabled={disabled}
          onStep={(delta) => onSetValue(Math.max(0, Number((stored + delta).toFixed(2))))}
          step={goal >= 20 ? Math.round(goal / 10) : goal >= 5 ? 1 : 0.5}
        />
      )}

      {task.kind === 'timer' && (
        <button
          type="button"
          disabled={disabled}
          onClick={isRunning ? onStopTimer : onStartTimer}
          className="press touch rounded-lg border px-3 py-1.5 font-mono text-xs disabled:opacity-40"
          style={{
            borderColor: isRunning ? 'var(--color-clay)' : 'var(--color-mist)',
            color: isRunning ? 'var(--color-clay)' : 'var(--color-ink-soft)',
            backgroundColor: isRunning ? 'hsl(8 52% 52% / 0.06)' : 'transparent',
          }}
        >
          {isRunning ? 'עצור' : 'התחל'}
        </button>
      )}

      <kbd className="tnum hidden w-4 shrink-0 text-end font-mono text-[10px] text-ink-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:block">
        {index < 9 ? index + 1 : ''}
      </kbd>
    </li>
  )
}

function Checkbox({
  done,
  disabled,
  label,
  onClick,
}: {
  done: boolean
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press touch grid h-7 w-7 shrink-0 place-items-center rounded-md border disabled:opacity-40"
      style={{
        borderColor: done ? 'var(--color-gold)' : 'var(--color-mist)',
        backgroundColor: done ? 'var(--color-gold)' : 'transparent',
        // Slight overshoot on the way in: the tick lands rather than fades.
        transition: 'background-color 160ms var(--ease-spring), border-color 160ms ease, transform 80ms ease',
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
  )
}

function Stepper({
  onStep,
  step,
  disabled,
}: {
  onStep: (delta: number) => void
  step: number
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-1">
      <StepButton disabled={disabled} onClick={() => onStep(-step)} label="הפחתה">
        &minus;
      </StepButton>
      <StepButton disabled={disabled} onClick={() => onStep(step)} label="הוספה">
        +
      </StepButton>
    </div>
  )
}

function StepButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press touch grid h-7 w-7 place-items-center rounded-md border border-mist text-ink-soft hover:bg-cream-dark disabled:opacity-40"
    >
      {children}
    </button>
  )
}
