/**
 * The budget engine (GLOBETROTTER_MASTER_PLAN.md §8.5).
 * PURE: no Prisma import, no `Decimal`, no `Date`. A wrong number here is worse than a crash,
 * so every rule is unit-tested in isolation (see budget.test.ts).
 */

export type Category = 'TRANSPORT' | 'STAY' | 'ACTIVITY' | 'MEAL' | 'OTHER'

export const CATEGORIES: Category[] = ['TRANSPORT', 'STAY', 'ACTIVITY', 'MEAL', 'OTHER']

export const NEAR_CAP_RATIO = 0.85

export interface BudgetStopInput {
  id: string
  city: string
  startDayIndex: number
  endDayIndex: number
}

export interface BudgetActivityInput {
  dayIndex: number
  cost: number
  stopId: string
}

export interface BudgetExpenseInput {
  category: Category
  amount: number
  dayIndex: number | null
  stopId: string | null
}

export interface BudgetTripInput {
  totalDays: number
  dayDates: string[] // "yyyy-MM-dd", index-aligned with dayIndex, length totalDays
  budgetCap: number | null
  currency: string
  stops: BudgetStopInput[]
  activities: BudgetActivityInput[]
  expenses: BudgetExpenseInput[]
}

export type CapStatus = 'under' | 'near' | 'over'

export interface BudgetSummary {
  total: number
  byCategory: { category: Category; amount: number; pct: number }[]
  byDay: { dayIndex: number; date: string; amount: number; overCap: boolean }[]
  byStop: { stopId: string; city: string; amount: number }[]
  avgPerDay: number
  dailyCap: number | null
  overBudgetDays: number[]
  capStatus: CapStatus
  currency: string
  budgetCap: number | null
  remaining: number | null
  capUsedPct: number | null
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function clampDay(dayIndex: number, totalDays: number): number {
  if (totalDays <= 0) return 0
  return Math.min(Math.max(dayIndex, 0), totalDays - 1)
}

export function emptyBudget(currency = 'INR'): BudgetSummary {
  return {
    total: 0,
    byCategory: CATEGORIES.map((category) => ({ category, amount: 0, pct: 0 })),
    byDay: [],
    byStop: [],
    avgPerDay: 0,
    dailyCap: null,
    overBudgetDays: [],
    capStatus: 'under',
    currency,
    budgetCap: null,
    remaining: null,
    capUsedPct: null,
  }
}

export function budgetFromTrip(trip: BudgetTripInput): BudgetSummary {
  const { totalDays, dayDates, budgetCap, currency, stops, activities, expenses } = trip

  if (totalDays <= 0) return emptyBudget(currency)

  const dayTotals = new Array(totalDays).fill(0) as number[]
  const categoryTotals: Record<Category, number> = {
    TRANSPORT: 0,
    STAY: 0,
    ACTIVITY: 0,
    MEAL: 0,
    OTHER: 0,
  }
  const stopTotals = new Map<string, number>(stops.map((s) => [s.id, 0]))

  for (const activity of activities) {
    const day = clampDay(activity.dayIndex, totalDays)
    dayTotals[day] += activity.cost
    categoryTotals.ACTIVITY += activity.cost
    if (stopTotals.has(activity.stopId)) {
      stopTotals.set(activity.stopId, (stopTotals.get(activity.stopId) ?? 0) + activity.cost)
    }
  }

  for (const expense of expenses) {
    categoryTotals[expense.category] += expense.amount

    if (expense.dayIndex !== null) {
      const day = clampDay(expense.dayIndex, totalDays)
      dayTotals[day] += expense.amount
      if (expense.stopId && stopTotals.has(expense.stopId)) {
        stopTotals.set(expense.stopId, (stopTotals.get(expense.stopId) ?? 0) + expense.amount)
      }
      continue
    }

    // No dayIndex: spread evenly across the owning stop's days (or the whole trip if stop-less),
    // never dumped on day 0 — otherwise the chart invents a spike that does not exist.
    const stop = expense.stopId ? stops.find((s) => s.id === expense.stopId) : undefined
    const rangeStart = stop ? clampDay(stop.startDayIndex, totalDays) : 0
    const rangeEnd = stop ? clampDay(stop.endDayIndex, totalDays) : totalDays - 1
    const span = Math.max(rangeEnd - rangeStart + 1, 1)
    const perDay = expense.amount / span

    for (let d = rangeStart; d <= rangeEnd; d++) dayTotals[d] += perDay
    if (stop) stopTotals.set(stop.id, (stopTotals.get(stop.id) ?? 0) + expense.amount)
  }

  const total = round2(Object.values(categoryTotals).reduce((a, b) => a + b, 0))
  const dailyCap = budgetCap !== null ? budgetCap / totalDays : null

  const byDay = dayTotals.map((amount, dayIndex) => ({
    dayIndex,
    date: dayDates[dayIndex],
    amount: round2(amount),
    overCap: dailyCap !== null && amount > dailyCap,
  }))

  const overBudgetDays = byDay.filter((d) => d.overCap).map((d) => d.dayIndex)

  const byCategory = CATEGORIES.map((category) => ({
    category,
    amount: round2(categoryTotals[category]),
    pct: total > 0 ? round2((categoryTotals[category] / total) * 100) : 0,
  }))

  const byStop = stops.map((s) => ({
    stopId: s.id,
    city: s.city,
    amount: round2(stopTotals.get(s.id) ?? 0),
  }))

  const capUsedPct = budgetCap !== null && budgetCap > 0 ? round2((total / budgetCap) * 100) : null
  const capStatus: CapStatus =
    budgetCap === null
      ? 'under'
      : budgetCap <= 0
        ? total > 0
          ? 'over'
          : 'under'
        : capUsedPct !== null && capUsedPct >= 100
          ? 'over'
          : capUsedPct !== null && capUsedPct >= NEAR_CAP_RATIO * 100
            ? 'near'
            : 'under'

  return {
    total,
    byCategory,
    byDay,
    byStop,
    avgPerDay: round2(total / totalDays),
    dailyCap: dailyCap !== null ? round2(dailyCap) : null,
    overBudgetDays,
    capStatus,
    currency,
    budgetCap,
    remaining: budgetCap !== null ? round2(budgetCap - total) : null,
    capUsedPct,
  }
}

// ---- formatting — the whole app agrees on money/duration shape through these ----

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

/** "₹12,480" — en-IN grouping, no decimals. */
export function formatMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currencySymbol(currency)}${Math.round(amount).toLocaleString('en-IN')}`
  }
}

const LAKH = 100_000
const CRORE = 10_000_000

/** "₹12.5k" / "₹1.2L" / "₹1.4Cr" — for chart axes and chips. */
export function formatMoneyShort(amount: number, currency = 'INR'): string {
  const symbol = currencySymbol(currency)
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (abs >= CRORE) return `${sign}${symbol}${(abs / CRORE).toFixed(1)}Cr`
  if (abs >= LAKH) return `${sign}${symbol}${(abs / LAKH).toFixed(1)}L`
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`
  return `${sign}${symbol}${Math.round(abs)}`
}

/** "2h 30m" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (hours === 0) return `${rem}m`
  if (rem === 0) return `${hours}h`
  return `${hours}h ${rem}m`
}
