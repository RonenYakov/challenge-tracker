import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type NewEvent } from '../lib/api'
import { Button, Card, Field, Input, Skeleton } from './ui'

/** 0 = Sunday, matching the server and Date#getUTCDay. */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Weekly recurring events: gym on Mon/Wed/Fri, a call on Sunday. Deliberately not
 * daily rules, and deliberately not scored. Missing one costs nothing, which is why
 * they live apart from the streak entirely.
 */
export function Schedule({ challengeId, manage }: { challengeId: string; manage?: boolean }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  const { data, isPending } = useQuery({
    queryKey: ['events', challengeId],
    queryFn: () => api.events(challengeId),
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['events', challengeId] })
  const create = useMutation({
    mutationFn: (body: NewEvent) => api.createEvent(challengeId, body),
    onSuccess: () => {
      refresh()
      setAdding(false)
    },
  })
  const remove = useMutation({ mutationFn: api.deleteEvent, onSuccess: refresh })

  const events = data?.events ?? []
  const upcoming = data?.upcoming ?? []

  if (isPending) return <Card><Skeleton className="h-20 w-full" /></Card>

  // On Today, stay quiet when there is nothing scheduled rather than nagging for setup.
  if (!manage && events.length === 0) return null

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="eyebrow">{manage ? 'Weekly schedule' : 'Coming up'}</p>
        {manage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="touch text-[12px] text-ink-muted underline hover:text-ink"
          >
            Add
          </button>
        )}
      </div>

      {!manage && (
        <ul className="grid gap-1.5">
          {upcoming.slice(0, 6).map((o, i) => (
            <li key={`${o.event.id}-${o.date}-${i}`} className="flex items-baseline gap-3">
              <span className="tnum shrink-0 font-mono text-[11px] text-ink-muted">
                {DAYS[new Date(`${o.date}T00:00:00Z`).getUTCDay()]} {o.event.timeOfDay}
              </span>
              <span
                className="truncate text-[14px]"
                style={{ unicodeBidi: 'plaintext', textAlign: 'left' }}
              >
                {o.event.title}
              </span>
            </li>
          ))}
          {upcoming.length === 0 && (
            <li className="text-[13px] text-ink-muted">Nothing scheduled in the next two weeks.</li>
          )}
        </ul>
      )}

      {manage && (
        <ul className="grid gap-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-3 rounded-xl border border-mist/60 bg-cream px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[15px]"
                  style={{ unicodeBidi: 'plaintext', textAlign: 'left' }}
                >
                  {event.title}
                </p>
                <p className="tnum mt-0.5 font-mono text-[11px] text-ink-muted">
                  {event.weekdays.map((d) => DAYS[d]).join(' ')} · {event.timeOfDay} ·{' '}
                  {event.durationMinutes} min
                </p>
              </div>
              <Button
                variant="ghost"
                className="px-2 text-[12px]"
                disabled={remove.isPending}
                onClick={() => remove.mutate(event.id)}
              >
                Remove
              </Button>
            </li>
          ))}
          {events.length === 0 && !adding && (
            <li className="text-[13px] text-ink-muted">
              Nothing scheduled. These are the things that support the challenge without
              being scored by it, like a gym session or a weekly call.
            </li>
          )}
        </ul>
      )}

      {manage && adding && (
        <NewEventForm
          pending={create.isPending}
          error={create.error as Error | null}
          onCancel={() => setAdding(false)}
          onSubmit={(body) => create.mutate(body)}
        />
      )}
    </Card>
  )
}

function NewEventForm({
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  onSubmit: (body: NewEvent) => void
  onCancel: () => void
  pending: boolean
  error: Error | null
}) {
  const [title, setTitle] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [timeOfDay, setTimeOfDay] = useState('18:00')
  const [durationMinutes, setDurationMinutes] = useState(60)

  const toggle = (day: number) =>
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    )

  return (
    <form
      className="mt-4 border-t border-mist/70 pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ title: title.trim(), weekdays, timeOfDay, durationMinutes })
      }}
    >
      <Field label="Event">
        <Input
          dir="auto"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Gym"
        />
      </Field>

      <div className="mt-3">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Days</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((label, day) => {
            const on = weekdays.includes(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggle(day)}
                className="press touch min-w-11 rounded-lg border px-2.5 py-2 text-[13px] sm:py-1"
                style={{
                  borderColor: on ? 'var(--color-orange)' : 'var(--color-mist)',
                  color: on ? 'var(--color-orange)' : 'var(--color-ink-muted)',
                  backgroundColor: on ? 'hsl(18 66% 50% / 0.07)' : 'transparent',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Time">
          <Input
            type="time"
            required
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
          />
        </Field>
        <Field label="Minutes">
          <Input
            type="number"
            min={5}
            max={1440}
            required
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
        </Field>
      </div>

      {error && (
        <p className="shake mt-3 text-sm" style={{ color: 'var(--color-clay)' }}>
          {error.message}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="secondary" loading={pending} disabled={weekdays.length === 0}>
          {pending ? 'Saving…' : 'Add event'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {weekdays.length === 0 && (
        <p className="mt-2 text-[12px] text-ink-muted">Pick at least one day.</p>
      )}
    </form>
  )
}
