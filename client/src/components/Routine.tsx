import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button, Card, Field, Input, Skeleton } from './ui'

/**
 * Four questions about the shape of the day, used only to propose anchors for habit
 * stacking. The app never applies a suggestion on its own: it offers candidates built
 * from the user's own routine, and accepting one writes it to the task's cue exactly as
 * typing it would.
 *
 * That split is deliberate. The effect behind implementation intentions comes from the
 * person committing to a moment, and people engage more with suggestions they can
 * override than with a schedule handed to them. Everything here is optional; with no
 * answers there are no suggestions, rather than generic advice pretending to be personal.
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
  }

  const applyCue = useMutation({
    mutationFn: ({ taskId, cue }: { taskId: string; cue: string }) =>
      api.updateTask(taskId, { cue }),
    onSuccess: refresh,
  })

  if (suggestions.isPending) return <Card><Skeleton className="h-24 w-full" /></Card>

  const routine = suggestions.data?.routine ?? null
  const rows = suggestions.data?.suggestions ?? []
  const hasAnchors = rows.some((r) => r.anchors.length > 0)

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
            Edit
          </button>
        )}
      </div>

      {!routine && !editing && (
        <div>
          <p className="text-[13px] text-ink-muted">
            Tell the app roughly when you wake, work and sleep, and it will suggest
            moments to attach each rule to. Anchoring a habit to something you already do
            every day is the most reliable way to make it stick. You pick, it only offers.
          </p>
          <Button variant="secondary" className="mt-3" onClick={() => setEditing(true)}>
            Answer four questions
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
        <div className="grid gap-4">
          {!hasAnchors && (
            <p className="text-[13px] text-ink-muted">
              Not enough to go on yet. Fill in a couple of times and suggestions appear.
            </p>
          )}

          {rows
            .filter((row) => row.anchors.length > 0)
            .map((row) => (
              <div key={row.taskId}>
                <p
                  className="truncate text-[14px]"
                  style={{ unicodeBidi: 'plaintext', textAlign: 'left' }}
                >
                  {row.label}
                </p>
                {row.currentCue ? (
                  <p className="mt-0.5 text-[12px]" style={{ color: 'var(--color-sage)' }}>
                    Anchored: {row.currentCue}
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {row.anchors.map((anchor) => (
                      <button
                        key={anchor.cue}
                        type="button"
                        disabled={applyCue.isPending}
                        onClick={() => applyCue.mutate({ taskId: row.taskId, cue: anchor.cue })}
                        className="press touch rounded-full border border-mist px-3 py-2 text-[12px] text-ink-soft hover:bg-cream-dark disabled:opacity-40 sm:py-1"
                      >
                        {anchor.cue}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

          <p className="text-[12px] text-ink-muted">
            These are suggestions, not a plan. Tap one to use it, or write your own on the
            rule itself.
          </p>
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
  initial: { wakeTime: string | null; workStart: string | null; workEnd: string | null; sleepTime: string | null; hasKids: boolean } | null
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
        <Field label="I wake up at">
          <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
        </Field>
        <Field label="I go to sleep at">
          <Input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
        </Field>
        <Field label="Work starts">
          <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
        </Field>
        <Field label="Work ends">
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
        I have kids at home
      </label>

      <p className="text-[12px] text-ink-muted">
        Leave anything blank you would rather not say. Blanks just mean fewer suggestions.
      </p>

      {save.isError && (
        <p className="shake text-sm" style={{ color: 'var(--color-clay)' }}>
          {(save.error as Error).message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="secondary" loading={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
