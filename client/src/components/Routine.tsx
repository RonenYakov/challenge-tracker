import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button, Card, Field, Input, Skeleton } from './ui'
import { TaskSchedule } from './TaskSchedule'

/**
 * Four optional questions about the shape of the day, then one tap per rule to say how
 * that rule sits in it.
 *
 * The app proposes, the user commits. The effect behind implementation intentions comes
 * from the person choosing a moment, and people engage more with suggestions they can
 * override than with a plan handed to them. With nothing filled in there are no
 * suggestions, rather than advice that would fit anyone.
 */
export function Routine({ challengeId }: { challengeId: string }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const suggestions = useQuery({
    queryKey: ['anchors', challengeId],
    queryFn: () => api.anchorSuggestions(challengeId),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['anchors', challengeId] })
    void queryClient.invalidateQueries({ queryKey: ['tasks', challengeId] })
    void queryClient.invalidateQueries({ queryKey: ['today'] })
    void queryClient.invalidateQueries({ queryKey: ['calendar-link'] })
  }

  if (suggestions.isPending) {
    return (
      <Card>
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  }

  const routine = suggestions.data?.routine ?? null
  const rows = suggestions.data?.suggestions ?? []

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="eyebrow">Your day</p>
        {routine && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="touch text-[12px] text-ink-muted underline hover:text-ink"
          >
            עריכת השעות
          </button>
        )}
      </div>

      {!routine && !editing && (
        <div>
          <p className="text-[13px] text-ink-muted">
            תגיד בערך מתי אתה קם, עובד וישן, ואפשר יהיה להציע לך רגעים לחבר אליהם כל
            כלל. עיגון הרגל למשהו שאתה כבר עושה כל יום הוא הדרך הכי אמינה לגרום לו
            להיתפס. אתה בוחר, כאן רק מציעים.
          </p>
          <Button variant="secondary" className="mt-3" onClick={() => setEditing(true)}>
            ארבע שאלות קצרות
          </Button>
        </div>
      )}

      {editing && (
        <RoutineForm
          initial={routine}
          onSaved={() => {
            refresh()
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {routine && !editing && (
        <div className="grid gap-5">
          <p className="text-[12px] text-ink-muted">
            תגדיר איך כל כלל יושב לך ביום. הצעות מופיעות רק איפה שיש בהן היגיון: למשהו
            שפרוס על כל היום אין רגע אחד להתחבר אליו.
          </p>

          {rows.map((row) => (
            <TaskSchedule key={row.taskId} row={row} onChanged={refresh} />
          ))}

          {rows.length === 0 && (
            <p className="text-[13px] text-ink-muted">קודם צריך להוסיף כללים.</p>
          )}
        </div>
      )}
    </Card>
  )
}

function RoutineForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: {
    wakeTime: string | null
    workStart: string | null
    workEnd: string | null
    sleepTime: string | null
    hasKids: boolean
  } | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [wakeTime, setWakeTime] = useState(initial?.wakeTime ?? '')
  const [workStart, setWorkStart] = useState(initial?.workStart ?? '')
  const [workEnd, setWorkEnd] = useState(initial?.workEnd ?? '')
  const [sleepTime, setSleepTime] = useState(initial?.sleepTime ?? '')
  const [hasKids, setHasKids] = useState(initial?.hasKids ?? false)

  const save = useMutation({
    mutationFn: () =>
      api.saveRoutine({
        wakeTime: wakeTime || null,
        workStart: workStart || null,
        workEnd: workEnd || null,
        sleepTime: sleepTime || null,
        hasKids,
      }),
    onSuccess: onSaved,
  })

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="אני קם ב">
          <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
        </Field>
        <Field label="אני הולך לישון ב">
          <Input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
        </Field>
        <Field label="העבודה מתחילה">
          <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
        </Field>
        <Field label="העבודה נגמרת">
          <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-[14px]">
        <input
          type="checkbox"
          checked={hasKids}
          onChange={(e) => setHasKids(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-orange)]"
        />
        יש לי ילדים בבית
      </label>

      <p className="text-[12px] text-ink-muted">
        אפשר להשאיר ריק כל מה שלא בא לך למלא. ריק פשוט אומר פחות הצעות.
      </p>

      {save.isError && (
        <p className="shake text-sm" style={{ color: 'var(--color-clay)' }}>
          {(save.error as Error).message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="secondary" loading={save.isPending}>
          {save.isPending ? 'שומר…' : 'שמירה'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </form>
  )
}
