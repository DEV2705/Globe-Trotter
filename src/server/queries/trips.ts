import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { toNumber } from '@/lib/utils'
import { utcDay, toDateInput, dayIndexFor, deriveStatus } from '@/lib/dates'
import { budgetFromTrip as computeBudget, emptyBudget, type BudgetSummary, type BudgetTripInput } from '@/lib/budget'
import { mapTripFull } from './_helpers'
import type { DerivedTripStatus, TripCardDTO, TripFullDTO, TripOption } from './types'

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

const TRIP_CARD_INCLUDE = {
  stops: {
    orderBy: { order: 'asc' as const },
    include: { city: true, items: true },
  },
  expenses: true,
}

type TripCardRow = Prisma.TripGetPayload<{ include: typeof TRIP_CARD_INCLUDE }>

function mapTripCard(trip: TripCardRow): TripCardDTO {
  const start = utcDay(trip.startDate)
  const end = utcDay(trip.endDate)
  const sortedStops = [...trip.stops].sort((a, b) => a.order - b.order)

  const activityTotal = sortedStops.flatMap((s) => s.items).reduce((sum, i) => sum + toNumber(i.cost), 0)
  const expenseTotal = trip.expenses.reduce((sum, e) => sum + toNumber(e.amount), 0)

  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    startDate: toDateInput(start),
    endDate: toDateInput(end),
    coverUrl: trip.coverUrl,
    status: deriveStatus(start, end),
    isPublic: trip.isPublic,
    shareSlug: trip.shareSlug,
    stopCount: sortedStops.length,
    cityNames: sortedStops.map((s) => s.city.name),
    totalCost: round2(activityTotal + expenseTotal),
    budgetCap: trip.budgetCap === null ? null : toNumber(trip.budgetCap),
    currency: trip.currency,
  }
}

export interface GetTripsParams {
  q?: string
  status?: DerivedTripStatus
  sort?: 'start-desc' | 'start-asc' | 'name' | 'cost'
}

export interface GetTripsResult {
  all: TripCardDTO[]
  ongoing: TripCardDTO[]
  upcoming: TripCardDTO[]
  completed: TripCardDTO[]
  total: number
}

function sortCards(cards: TripCardDTO[], sort: GetTripsParams['sort']): TripCardDTO[] {
  const sorted = [...cards]
  switch (sort) {
    case 'start-asc':
      return sorted.sort((a, b) => a.startDate.localeCompare(b.startDate))
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'cost':
      return sorted.sort((a, b) => b.totalCost - a.totalCost)
    case 'start-desc':
    default:
      return sorted.sort((a, b) => b.startDate.localeCompare(a.startDate))
  }
}

/** Filtering happens in SQL (§3.5); status bucketing happens here because status is always
 * derived from dates at query time (§6.4), never trusted from the cached column. */
export async function getTrips(userId: string, params: GetTripsParams = {}): Promise<GetTripsResult> {
  const { q, status, sort = 'start-desc' } = params

  const trips = await db.trip.findMany({
    where: {
      userId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { stops: { some: { city: { name: { contains: q, mode: 'insensitive' as const } } } } },
            ],
          }
        : {}),
    },
    include: TRIP_CARD_INCLUDE,
  })

  const cards = trips.map(mapTripCard)
  const ongoing = sortCards(cards.filter((c) => c.status === 'ONGOING'), sort)
  const upcoming = sortCards(cards.filter((c) => c.status === 'UPCOMING'), sort)
  const completed = sortCards(cards.filter((c) => c.status === 'COMPLETED'), sort)
  const all = sortCards(status ? cards.filter((c) => c.status === status) : cards, sort)

  return { all, ongoing, upcoming, completed, total: cards.length }
}

export async function getTripOptions(userId: string): Promise<TripOption[]> {
  const trips = await db.trip.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      stops: {
        orderBy: { order: 'asc' },
        select: { id: true, startDate: true, endDate: true, city: { select: { name: true } } },
      },
    },
  })

  return trips.map((trip) => {
    const start = utcDay(trip.startDate)
    return {
      id: trip.id,
      name: trip.name,
      stops: trip.stops.map((s) => ({
        id: s.id,
        cityName: s.city.name,
        startDayIndex: dayIndexFor(start, s.startDate),
        endDayIndex: dayIndexFor(start, s.endDate),
      })),
    }
  })
}

const TRIP_FULL_INCLUDE = {
  stops: {
    orderBy: { order: 'asc' as const },
    include: {
      city: true,
      items: { include: { activity: { include: { city: true } } } },
    },
  },
  expenses: true,
}

/** One query for the whole tree — Screens 5, 9 and 11 all render from this single shape. */
export async function getTripFull(tripId: string): Promise<TripFullDTO | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: TRIP_FULL_INCLUDE,
  })
  if (!trip) return null
  return mapTripFull(trip)
}

function tripFullToBudgetInput(trip: TripFullDTO): BudgetTripInput {
  return {
    totalDays: trip.totalDays,
    dayDates: trip.dayDates,
    budgetCap: trip.budgetCap,
    currency: trip.currency,
    stops: trip.stops.map((s) => ({
      id: s.id,
      city: s.city.name,
      startDayIndex: s.startDayIndex,
      endDayIndex: s.endDayIndex,
    })),
    activities: trip.stops.flatMap((s) =>
      s.items.map((i) => ({ dayIndex: i.dayIndex, cost: i.cost, stopId: s.id }))
    ),
    expenses: trip.expenses.map((e) => ({
      category: e.category,
      amount: e.amount,
      dayIndex: e.dayIndex,
      stopId: e.stopId,
    })),
  }
}

/** Pure derivation from an already-fetched TripFullDTO — no second round trip. */
export function budgetFromTrip(trip: TripFullDTO): BudgetSummary {
  return computeBudget(tripFullToBudgetInput(trip))
}

export async function getBudget(tripId: string): Promise<BudgetSummary> {
  const trip = await getTripFull(tripId)
  if (!trip) return emptyBudget()
  return budgetFromTrip(trip)
}

/** Read-only; increments viewCount fire-and-forget. isPublic trips only. */
export async function getPublicTrip(slug: string): Promise<TripFullDTO | null> {
  const trip = await db.trip.findUnique({
    where: { shareSlug: slug },
    include: TRIP_FULL_INCLUDE,
  })
  if (!trip || !trip.isPublic) return null

  db.trip
    .update({ where: { id: trip.id }, data: { viewCount: { increment: 1 } } })
    .catch((error) => console.error('viewCount increment failed', error))

  return mapTripFull(trip)
}

/** Inspiration rail + Copy Trip demo. */
export async function getPublicTrips(take = 8): Promise<TripCardDTO[]> {
  const trips = await db.trip.findMany({
    where: { isPublic: true },
    orderBy: { viewCount: 'desc' },
    take,
    include: TRIP_CARD_INCLUDE,
  })
  return trips.map(mapTripCard)
}
