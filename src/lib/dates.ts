import { format } from 'date-fns'

/**
 * UTC discipline (GLOBETROTTER_MASTER_PLAN.md §3.3): every trip date is stored as UTC midnight.
 * All arithmetic here works in epoch-day space so the result never depends on the server's TZ.
 * `format()` from date-fns reads LOCAL getters, so before handing a Date to it we rebuild an
 * equivalent Date whose local Y/M/D match the UTC Y/M/D — never format a raw UTC Date directly.
 */

const DAY_MS = 86_400_000

function toEpochDay(date: Date): number {
  return Math.round(date.getTime() / DAY_MS)
}

function fromEpochDay(epochDay: number): Date {
  return new Date(epochDay * DAY_MS)
}

/** Coerce anything date-like to UTC midnight. */
export function utcDay(value: Date | string | number): Date {
  const d = value instanceof Date ? value : new Date(value)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Parse a form value ("2026-03-12") as a UTC calendar day — never `new Date(str)`. */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Value for `<input type="date">`. */
export function toDateInput(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Rebuild a UTC-midnight Date as an equivalent local-midnight Date, safe to hand to date-fns `format`. */
function toLocalForDisplay(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function formatDay(date: Date, pattern = 'd MMM yyyy'): string {
  return format(toLocalForDisplay(date), pattern)
}

/** "12 – 25 Mar 2026", collapsing repeated month/year. */
export function formatRange(start: Date, end: Date): string {
  const s = toLocalForDisplay(start)
  const e = toLocalForDisplay(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  const sameMonth = sameYear && s.getMonth() === e.getMonth()

  if (sameMonth) {
    return `${format(s, 'd')} – ${format(e, 'd MMM yyyy')}`
  }
  if (sameYear) {
    return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`
  }
  return `${format(s, 'd MMM yyyy')} – ${format(e, 'd MMM yyyy')}`
}

/** Inclusive length in days; a same-day trip is 1. */
export function tripLength(start: Date, end: Date): number {
  return toEpochDay(utcDay(end)) - toEpochDay(utcDay(start)) + 1
}

/** Every UTC day of the trip, inclusive. */
export function eachDayOfTrip(start: Date, end: Date): Date[] {
  const s = toEpochDay(utcDay(start))
  const e = toEpochDay(utcDay(end))
  const out: Date[] = []
  for (let i = s; i <= e; i++) out.push(fromEpochDay(i))
  return out
}

/** Trip-relative, 0-based; -1 when the date falls before the trip start. */
export function dayIndexFor(tripStart: Date, date: Date): number {
  const diff = toEpochDay(utcDay(date)) - toEpochDay(utcDay(tripStart))
  return diff < 0 ? -1 : diff
}

export function dateForDayIndex(tripStart: Date, i: number): Date {
  return fromEpochDay(toEpochDay(utcDay(tripStart)) + i)
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return toEpochDay(utcDay(a)) === toEpochDay(utcDay(b))
}

export function todayUtc(): Date {
  return utcDay(new Date())
}

export type DerivedStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED'

export function deriveStatus(start: Date, end: Date): DerivedStatus {
  const today = toEpochDay(todayUtc())
  const s = toEpochDay(utcDay(start))
  const e = toEpochDay(utcDay(end))
  if (today < s) return 'UPCOMING'
  if (today > e) return 'COMPLETED'
  return 'ONGOING'
}

/** Positive = in the future, negative = in the past, 0 = today. */
export function daysUntil(date: Date): number {
  return toEpochDay(utcDay(date)) - toEpochDay(todayUtc())
}

export function isInRange(date: Date, start: Date, end: Date): boolean {
  const d = toEpochDay(utcDay(date))
  return d >= toEpochDay(utcDay(start)) && d <= toEpochDay(utcDay(end))
}

/** Weeks x 7, Monday-first, covering the full calendar month of `anchor`. */
export function monthGrid(anchor: Date): Date[][] {
  const a = utcDay(anchor)
  const firstOfMonth = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1))
  const lastOfMonth = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0))

  const mondayOffset = (firstOfMonth.getUTCDay() + 6) % 7 // 0 = Monday
  const gridStart = toEpochDay(firstOfMonth) - mondayOffset

  const sundayOffset = (7 - ((lastOfMonth.getUTCDay() + 6) % 7) - 1) % 7
  const gridEnd = toEpochDay(lastOfMonth) + sundayOffset

  const weeks: Date[][] = []
  for (let dayStart = gridStart; dayStart <= gridEnd; dayStart += 7) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) week.push(fromEpochDay(dayStart + i))
    weeks.push(week)
  }
  return weeks
}
