import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Task, TaskKind } from '@ct/shared'
import { api, type NewTask } from '../lib/api'
import { Button, Card, Field, Input, Skeleton } from '../components/ui'
import { CalendarLink, Schedule } from '../components/Schedule'
import { Routine } from '../components/Routine'
import { SHABBAT_PRESET, WeekdayPicker } from '../components/WeekdayPicker'
import { formatDateShort } from '../lib/format'

const KIND_LABEL: Record<TaskKind, string> = {
  check: 'בוצע / לא בוצע',
  count: 'ספירה עד יעד',
  timer: 'מתוזמן',
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
  const setRestWeekdays = useMutation({
    mutationFn: (restWeekdays: number[]) => api.updateChallenge(id, { restWeekdays }),
    onSuccess: refresh,
  })
  const renameTask = useMutation({
    mutationFn: ({ id: taskId, label }: { id: string; label: string }) =>
      api.updateTask(taskId, { label }),
    onSuccess: refresh,
  })
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
  if (!challenge.data) return <p className="text-sm text-ink-muted">האתגר לא נמצא.</p>

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
        {c.lengthDays} ימים · מ-{formatDateShort(c.startDate)} · היום נגמר ב-{String(c.dayCutoffHour).padStart(2, '0')}:00 ·{' '}
        {c.graceTokensTotal} חסד · {c.timezone}
      </p>

      <Card className="mt-5">
        <WeekdayPicker
          label="ימי מנוחה (לא חובה)"
          hint={
            isRunning
              ? 'נעול בזמן שהאתגר רץ. שינוי עכשיו יוציא מהרצף ימים שכבר סיימת ויזיז את קו הסיום.'
              : 'לרוב אין צורך בזה. אם אתה שומר שבת, או שיש יום קבוע שבו אתה לא מתאמן, סמן אותו כאן: לא נדרש בו כלום, הוא לא נחשב החמצה, והרצף ממשיך מעליו. האורך נספר בימי עבודה, אז 60 יום עם שבתות פנויות נמשכים בערך 70 יום בלוח השנה.'
          }
          disabled={isRunning || setRestWeekdays.isPending}
          selected={c.restWeekdays}
          onChange={(days) => setRestWeekdays.mutate(days)}
          presets={[SHABBAT_PRESET]}
        />
        {setRestWeekdays.error && (
          <p className="shake mt-3 text-sm" style={{ color: 'var(--color-clay)' }}>
            {(setRestWeekdays.error as Error).message}
          </p>
        )}
      </Card>

      <Card className="mt-4">
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
              onRename={(label) => renameTask.mutate({ id: task.id, label })}
              removing={removeTask.isPending}
              isRunning={isRunning}
            />
          ))}
        </ul>

        {activeTasks.length === 0 && (
          <p className="text-sm text-ink-muted">עוד אין כללים. הוסף את הראשון למטה.</p>
        )}

        {activeTasks.length > 0 && (
          <p className="mt-3 text-[12px] text-ink-muted">
            לחיצה על כלל משנה את השם שלו. היעדים נעולים בזמן שהאתגר רץ, כי שינוי שלהם
            ינקד מחדש ימים שכבר סיימת.
          </p>
        )}

        <AddTaskForm
          pending={addTask.isPending}
          error={addTask.error as Error | null}
          nextSortOrder={activeTasks.length}
          onSubmit={(body) => addTask.mutate(body)}
        />
      </Card>

      <div className="mt-4 grid gap-4">
        <Routine challengeId={id} />
        <Schedule challengeId={id} manage />
        <CalendarLink />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!isRunning && (
          <Button
            variant="primary"
            disabled={activeTasks.length === 0 || activate.isPending}
            onClick={() => activate.mutate()}
          >
            התחלת האתגר
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate('/challenges')}>
          חזרה
        </Button>
        <Button
          variant="danger"
          className="ms-auto"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm('למחוק את האתגר הזה ואת כל מה שתועד בו?')) remove.mutate()
          }}
        >
          מחיקה
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
  onRename,
  removing,
  isRunning,
}: {
  task: Task
  onRemove: () => void
  onRename: (label: string) => void
  removing: boolean
  isRunning: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(task.label)

  const commit = () => {
    const next = label.trim()
    setEditing(false)
    if (next && next !== task.label) onRename(next)
    else setLabel(task.label)
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-mist/60 bg-cream px-3 py-2.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            dir="auto"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setLabel(task.label)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="שינוי שם"
            className="block w-full truncate text-start text-[15px] hover:text-ink-soft"
            style={{ unicodeBidi: 'plaintext' }}
          >
            {task.label}
          </button>
        )}
        <p className="tnum mt-0.5 font-mono text-[11px] text-ink-muted">
          {task.kind === 'check'
            ? KIND_LABEL.check
            : `${task.targetValue} ${task.unit ?? ''} · ${KIND_LABEL[task.kind]}`}
          {isRunning && task.kind !== 'check' && ' · נעול בזמן ריצה'}
        </p>
        {task.cue && (
          <p className="mt-0.5 text-[11px] text-ink-muted" style={{ unicodeBidi: 'plaintext' }}>
            {task.cue}
          </p>
        )}
      </div>
      <Button variant="ghost" disabled={removing} onClick={onRemove} className="px-2 text-[12px]">
        הסרה
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
  const [cue, setCue] = useState('')

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
          cue: cue.trim() || null,
          // How it sits in the day is chosen afterwards, one tap per rule, in "Your day".
          scheduleMode: cue.trim() ? 'anchored' : 'unset',
          scheduledTime: null,
        })
        setLabel('')
        setTargetValue('')
        setUnit('')
        setCue('')
        setKind('check')
      }}
    >
      <Field label="הוספת כלל">
        <Input
          dir="auto"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="לקרוא 10 עמודים"
        />
      </Field>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(KIND_LABEL) as TaskKind[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className="press touch rounded-full border px-3 py-2 text-[13px] sm:py-1 sm:text-[12px]"
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
          <Field label="יעד">
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
          <Field label="יחידה">
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={kind === 'timer' ? 'דק׳' : 'ליטר'}
            />
          </Field>
        </div>
      )}

      <div className="mt-3">
        <Field
          label="מתי ואיפה (לא חובה)"
          hint="לנקוב ברגע המדויק זה אחד מהטריקים הבודדים לבניית הרגלים שיש מאחוריו ראיות אמיתיות. תבחר רמז שאתה כבר עובר בו כל יום."
        >
          <Input
            dir="auto"
            value={cue}
            onChange={(e) => setCue(e.target.value)}
            placeholder="אחרי שאני מצחצח שיניים"
          />
        </Field>
      </div>

      {error && (
        <p className="shake mt-3 text-sm" style={{ color: 'var(--color-clay)' }}>
          {error.message}
        </p>
      )}

      <Button type="submit" className="mt-3" loading={pending}>
        הוספת כלל
      </Button>
    </form>
  )
}
