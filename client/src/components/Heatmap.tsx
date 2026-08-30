import { addDays, dayNumber } from '@ct/shared'
import type { Challenge, DayLog } from '@ct/shared'

interface HeatmapProps {
  challenge: Challenge
  days: DayLog[]
  today: string
  onSelect?: (date: string) => void
}

const FILL: Record<DayLog['status'] | 'empty' | 'future' | 'today', string> = {
  complete: 'var(--color-gold)',
  graced: 'var(--color-gold-dim)',
  incomplete: 'var(--color-clay)',
  pending: 'var(--color-cream-dark)',
  empty: 'var(--color-cream-dark)',
  future: 'transparent',
  today: 'var(--color-cream-dark)',
}

/**
 * The whole challenge at a glance. Days from earlier attempts are shown faded rather
 * than hidden: a run that failed is part of the record.
 */
export function Heatmap({ challenge, days, today, onSelect }: HeatmapProps) {
  const byDate = new Map(days.map((d) => [d.logDate, d]))
  const todayNumber = dayNumber(today, challenge.startDate)

  /**
   * A reset moves `startDate` forward, which would push every day of the failed attempt
   * outside the window and quietly erase it from view. Extend the grid back to the
   * earliest day actually logged so previous attempts stay on the wall.
   */
  const earliestLogged = days.reduce<string | null>(
    (min, d) => (min === null || d.logDate < min ? d.logDate : min),
    null,
  )
  const gridStart =
    earliestLogged && earliestLogged < challenge.startDate ? earliestLogged : challenge.startDate
  const leadIn = dayNumber(challenge.startDate, gridStart) - 1
  const totalCells = leadIn + challenge.lengthDays

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const date = addDays(gridStart, i)
    const log = byDate.get(date)
    const dayNo = i - leadIn + 1
    const isFuture = dayNo > todayNumber
    const isToday = dayNo === todayNumber
    const status = log?.status ?? (isFuture ? 'future' : 'empty')
    const fromPastAttempt = log ? log.attemptNo < challenge.attemptNo : dayNo < 1

    return { date, dayNo: log?.dayNumber ?? dayNo, status, isToday, isFuture, fromPastAttempt }
  })

  return (
    <div
      className="grid gap-[5px]"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14px, 1fr))' }}
    >
      {cells.map((cell) => (
        <button
          key={cell.date}
          type="button"
          disabled={cell.isFuture || !onSelect}
          onClick={() => onSelect?.(cell.date)}
          title={`Day ${cell.dayNo} · ${cell.date}${cell.status === 'future' ? '' : ` · ${cell.status}`}`}
          aria-label={`Day ${cell.dayNo}, ${cell.status}`}
          className="aspect-square rounded-[3px] border transition-transform duration-100 enabled:hover:scale-125 disabled:cursor-default"
          style={{
            backgroundColor: FILL[cell.status as keyof typeof FILL],
            opacity: cell.fromPastAttempt ? 0.35 : 1,
            borderColor: cell.isToday
              ? 'var(--color-orange)'
              : cell.isFuture
                ? 'var(--color-mist)'
                : 'transparent',
            borderWidth: cell.isToday ? 1.5 : 1,
          }}
        />
      ))}
    </div>
  )
}

export function HeatmapLegend() {
  const items = [
    ['Done', FILL.complete],
    ['Grace', FILL.graced],
    ['Missed', FILL.incomplete],
    ['Not yet', FILL.empty],
  ] as const

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  )
}
