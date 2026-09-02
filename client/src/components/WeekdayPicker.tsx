/** Single Hebrew letters, 0 = Sunday. Wide enough to read, short enough for seven chips. */
export const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

export interface WeekdayPreset {
  label: string
  days: number[]
}

const sameDays = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort().every((day, i) => day === [...b].sort()[i])

/**
 * Weekday chips, 0 = Sunday. Used for scheduled events and for the days a challenge
 * sets aside, which want exactly the same control.
 *
 * Owns the toggling itself and hands back the whole selection, so the three call sites
 * do not each carry their own copy of the same add-or-remove reducer.
 *
 * `presets` are for the common answer that would otherwise take a moment to work out
 * from seven identical chips. Tapping one selects exactly those days; tapping it again
 * clears the selection.
 */
export function WeekdayPicker({
  label,
  hint,
  selected,
  onChange,
  presets,
  disabled = false,
}: {
  label: string
  hint?: string
  selected: readonly number[]
  onChange: (days: number[]) => void
  presets?: readonly WeekdayPreset[]
  disabled?: boolean
}) {
  const toggle = (day: number) =>
    onChange(
      selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day].sort(),
    )

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>

      <div className="flex flex-wrap items-center gap-1.5">
        {WEEKDAY_LABELS.map((text, day) => {
          const on = selected.includes(day)
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => toggle(day)}
              className="press touch min-w-11 rounded-lg border px-2.5 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40 sm:py-1"
              style={{
                borderColor: on ? 'var(--color-orange)' : 'var(--color-mist)',
                color: on ? 'var(--color-orange)' : 'var(--color-ink-muted)',
                backgroundColor: on ? 'hsl(18 66% 50% / 0.07)' : 'transparent',
              }}
            >
              {text}
            </button>
          )
        })}

        {presets?.map((preset) => {
          const on = sameDays(selected, preset.days)
          return (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(on ? [] : [...preset.days])}
              className="press touch ms-1 rounded-full border border-dashed px-3 py-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-40 sm:py-1"
              style={{
                borderColor: on ? 'var(--color-orange)' : 'var(--color-mist)',
                color: on ? 'var(--color-orange)' : 'var(--color-ink-muted)',
              }}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {hint && <p className="mt-1.5 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  )
}

/** The one answer most people picking rest days are actually reaching for. */
export const SHABBAT_PRESET: WeekdayPreset = { label: 'שבת', days: [6] }
