import { db } from '@/server/db'
import { toNumber } from '@/lib/utils'
import type { ActivityType } from '@/server/queries/types'

/**
 * A ready-made day-by-day plan for a destination, built from the catalogue's best-rated
 * activities. It is a *preview*: nothing is written until the traveller accepts it.
 */

export const DEFAULT_ITINERARY_DAYS = 3
export const MIN_ITINERARY_DAYS = 1
export const MAX_ITINERARY_DAYS = 7

const SLOTS_PER_DAY = 3
/** Morning / afternoon / evening — the shape most city days actually take. */
const SLOT_TIMES = ['09:30', '13:30', '18:00']

export interface ItineraryItem {
  activityId: string
  name: string
  type: ActivityType
  description: string
  startTime: string
  cost: number
  durationMin: number
  rating: number
}

export interface ItineraryDay {
  dayIndex: number
  items: ItineraryItem[]
}

export interface CityItinerary {
  city: {
    id: string
    name: string
    country: string
    imageUrl: string | null
    costIndex: number
  }
  days: ItineraryDay[]
  dayCount: number
  totalCost: number
  activityCount: number
}

export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_ITINERARY_DAYS
  return Math.min(MAX_ITINERARY_DAYS, Math.max(MIN_ITINERARY_DAYS, Math.round(days)))
}

export async function getCityItinerary(
  cityId: string,
  requestedDays = DEFAULT_ITINERARY_DAYS
): Promise<CityItinerary | null> {
  const days = clampDays(requestedDays)

  const city = await db.city.findUnique({
    where: { id: cityId },
    select: { id: true, name: true, country: true, imageUrl: true, costIndex: true },
  })
  if (!city) return null

  const activities = await db.activity.findMany({
    where: { cityId },
    orderBy: [{ rating: 'desc' }, { name: 'asc' }],
    take: days * SLOTS_PER_DAY,
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      avgCost: true,
      durationMin: true,
      rating: true,
    },
  })

  // Deal round-robin rather than in blocks, so day one does not hoard every top-rated stop.
  const buckets: ItineraryItem[][] = Array.from({ length: days }, () => [])
  activities.forEach((activity, i) => {
    const day = i % days
    buckets[day].push({
      activityId: activity.id,
      name: activity.name,
      type: activity.type as ActivityType,
      description: activity.description,
      startTime: SLOT_TIMES[buckets[day].length] ?? SLOT_TIMES[SLOT_TIMES.length - 1],
      cost: toNumber(activity.avgCost),
      durationMin: activity.durationMin,
      rating: activity.rating,
    })
  })

  const itineraryDays = buckets.map((items, dayIndex) => ({ dayIndex, items }))
  const flat = itineraryDays.flatMap((d) => d.items)

  return {
    city,
    days: itineraryDays,
    dayCount: days,
    totalCost: flat.reduce((sum, i) => sum + i.cost, 0),
    activityCount: flat.length,
  }
}
