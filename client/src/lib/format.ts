/**
 * Dates are stored and reasoned about as 'YYYY-MM-DD' strings and only ever become
 * words here. Parsed at midnight UTC and formatted in the same zone, so the displayed
 * day always matches the stored one no matter where the browser thinks it is.
 */
export function formatDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    ...options,
  }).format(new Date(`${date}T00:00:00Z`))
}

/** Short form for dense rows: '7 באוג׳ 2026'. */
export function formatDateShort(date: string): string {
  return formatDate(date, { month: 'short', year: 'numeric' })
}
