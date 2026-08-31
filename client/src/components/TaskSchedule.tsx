import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { Task } from '@ct/shared'
import { api, type TaskAnchors } from '../lib/api'
import { Input } from './ui'

type Mode = Task['scheduleMode']

/**
 * How one rule sits in the day.
 *
 * Rules differ in kind, not just in length. Drinking 1.5L of water happens across the
 * whole day, LeetCode happens at 10:00, reading happens after something else. Nothing
 * in the rule's type or target distinguishes those, which is why every rule was being
 * offered the same three anchors, bedtime included, water included.
 *
 * One tap says which it is. That is more accurate than any classifier, because the
 * person knows and the software is guessing.
 */
const OPTIONS: { mode: Exclude<Mode, 'unset'>; label: string; hint: string }[] = [
  { mode: 'fixed', label: 'At a set time', hint: 'LeetCode at 10:00' },
  { mode: 'anchored', label: 'After something else', hint: 'once the kids are in bed' },
  { mode: 'anytime', label: 'Across the day', hint: 'water, steps, protein' },
]

export function TaskSchedule({ row, onChanged }: { row: TaskAnchors; onChanged: () => void }) {
  const [time, setTime] = useState(row.scheduledTime ?? '10:00')

  const save = useMutation({
    mutationFn: ({ mode, at }: { mode: Mode; at: string | null }) =>
      api.setTaskSchedule(row.taskId, mode, at),
    onSuccess: onChanged,
  })

  const setCue = useMutation({
    mutationFn: (cue: string) => api.updateTask(row.taskId, { cue, scheduleMode: 'anchored' }),
    onSuccess: onChanged,
  })

  const mode = row.scheduleMode

  return (
    <div>
      <p
        className="truncate text-[14px]"
        style={{ unicodeBidi: 'plaintext', textAlign: 'left' }}
      >
        {row.label}
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {OPTIONS.map((option) => {
          const on = mode === option.mode
          return (
            <button
              key={option.mode}
              type="button"
              disabled={save.isPending}
              title={option.hint}
              onClick={() =>
                save.mutate({
                  mode: option.mode,
                  at: option.mode === 'fixed' ? time : null,
                })
              }
              className="press touch rounded-full border px-3 py-2 text-[12px] disabled:opacity-40 sm:py-1"
              style={{
                borderColor: on ? 'var(--color-orange)' : 'var(--color-mist)',
                color: on ? 'var(--color-orange)' : 'var(--color-ink-muted)',
                backgroundColor: on ? 'hsl(18 66% 50% / 0.07)' : 'transparent',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {mode === 'fixed' && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              save.mutate({ mode: 'fixed', at: e.target.value })
            }}
            className="max-w-[9rem]"
          />
          <span className="text-[12px] text-ink-muted">every day, and in your calendar</span>
        </div>
      )}

      {mode === 'anytime' && (
        <p className="mt-1.5 text-[12px] text-ink-muted">
          No single moment, so nothing to anchor. Just get it done before the day closes.
        </p>
      )}

      {mode === 'anchored' &&
        (row.currentCue ? (
          <p className="mt-1.5 text-[12px]" style={{ color: 'var(--color-sage)' }}>
            After: {row.currentCue}
          </p>
        ) : row.anchors.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.anchors.map((anchor) => (
              <button
                key={anchor.cue}
                type="button"
                disabled={setCue.isPending}
                onClick={() => setCue.mutate(anchor.cue)}
                className="press touch rounded-full border border-mist px-3 py-2 text-[12px] text-ink-soft hover:bg-cream-dark disabled:opacity-40 sm:py-1"
              >
                {anchor.cue}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[12px] text-ink-muted">
            Fill in more of your day above and suggestions appear here, or write a cue on
            the rule itself.
          </p>
        ))}
    </div>
  )
}
