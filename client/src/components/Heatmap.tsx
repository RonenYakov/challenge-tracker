import { activeDaysBefore, addDays, isRestDay } from '@ct/shared'
import { formatDate } from '../lib/format'
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

const STATUS_TEXT: Record<string, string> = {
  complete: 'הושלם',
  graced: 'חסד',
  incomplete: 'הוחמץ',
  pending: 'פתוח',
  empty: 'לא תועד',
  today: 'היום',
}

/**
 * The whole challenge at a glance. Days from earlier attempts are shown faded rather
 * than hidden: a run that failed is part of the record.
 */
export function Heatmap({ challenge, days, today, onSelect }: HeatmapProps) {
  const byDate = new Map(days.map((d) => [d.logDate, d]))
  const rest = challenge.restWeekdays

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
  const leadIn = activeDaysBefore(challenge.startDate, gridStart, rest)
  const totalCells = leadIn + challenge.lengthDays

  /*
    One cell per day of the challenge, so rest days simply are not on the wall. The grid
    is auto-fill with no weekday columns, so there is no calendar alignment to lose by
    skipping them, and the count finally matches the length.

    A single forward walk, because asking for the date of each day number in turn would
    re-walk from the start every cell.
  */
  const cells: {
    date: string
    dayNo: number
    status: string
    isToday: boolean
    isFuture: boolean
    fromPastAttempt: boolean
  }[] = []

  let index = 0
  for (let date = gridStart; cells.length < totalCells; date = addDays(date, 1)) {
    const log = byDate.get(date)
    // A row on a rest date can only come from before the rest day was set aside. Keeping
    // it visible matters more than a tidy grid: this wall is the record of what happened.
    if (isRestDay(date, rest) && !log) continue

    const dayNo = index - leadIn + 1
    if (!isRestDay(date, rest)) index++

    cells.push({
      date,
      dayNo: log?.dayNumber ?? dayNo,
      status: log?.status ?? (date > today ? 'future' : 'empty'),
      isToday: date === today,
      isFuture: date > today,
      fromPastAttempt: log ? log.attemptNo < challenge.attemptNo : dayNo < 1,
    })
  }

  return (
    <div
      className="grid gap-[5px] [--cell:16px] sm:[--cell:14px]"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(var(--cell, 14px), 1fr))' }}
    >
      {cells.map((cell) => (
        <button
          key={cell.date}
          type="button"
          disabled={cell.isFuture || !onSelect}
          onClick={() => onSelect?.(cell.date)}
          title={`יום ${cell.dayNo} · ${formatDate(cell.date)}${cell.status === 'future' ? '' : ` · ${STATUS_TEXT[cell.status] ?? cell.status}`}`}
          aria-label={`יום ${cell.dayNo}, ${STATUS_TEXT[cell.status] ?? cell.status}`}
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
    ['הושלם', FILL.complete],
    ['חסד', FILL.graced],
    ['הוחמץ', FILL.incomplete],
    ['עוד לא', FILL.empty],
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
