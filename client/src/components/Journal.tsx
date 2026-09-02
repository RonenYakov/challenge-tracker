import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from './ui'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * One free-text note per day. Optional by design: it never affects the ring, the streak
 * or the day's status, so leaving it blank costs nothing. It is the part of the record
 * that explains the grid a year later.
 */
export function Journal({ date, initialNote }: { date: string; initialNote: string | null }) {
  const [text, setText] = useState(initialNote ?? '')
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef(initialNote ?? '')

  // Reset when the logical day rolls over, so yesterday's note is never left in the box.
  useEffect(() => {
    setText(initialNote ?? '')
    lastSaved.current = initialNote ?? ''
    setState('idle')
  }, [date, initialNote])

  const save = useMutation({
    mutationFn: (value: string) => api.saveNote(date, value === '' ? null : value),
    onSuccess: (_data, value) => {
      lastSaved.current = value
      setState('saved')
    },
    onError: () => setState('error'),
  })

  /** Debounced: typing does not fire a request per keystroke. */
  const scheduleSave = (value: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (value === lastSaved.current) return
      setState('saving')
      save.mutate(value)
    }, 900)
  }

  // A note half-typed when the tab closes is worse than one saved a beat early.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="eyebrow">Today&rsquo;s note</p>
        <span className="font-mono text-[11px] text-ink-muted">
          {state === 'saving' && 'שומר…'}
          {state === 'saved' && 'נשמר'}
          {state === 'error' && (
            <button
              type="button"
              onClick={() => {
                setState('saving')
                save.mutate(text)
              }}
              className="underline"
              style={{ color: 'var(--color-clay)' }}
            >
              לא נשמר. נסה שוב
            </button>
          )}
        </span>
      </div>

      <textarea
        dir="auto"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          scheduleSave(e.target.value)
        }}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current)
          if (text !== lastSaved.current) {
            setState('saving')
            save.mutate(text)
          }
        }}
        rows={3}
        maxLength={5000}
        placeholder="איך היה היום באמת? לא חובה, ואף אחד חוץ ממך לא רואה את זה."
        className="w-full resize-y rounded-lg border border-mist bg-cream px-3 py-2 text-[15px] leading-relaxed text-ink transition-colors duration-150 placeholder:text-ink-muted/70 focus:border-orange focus:outline-none"
      />
    </Card>
  )
}
