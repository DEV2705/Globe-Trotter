'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import { requireUser } from '@/server/auth'
import { getCityItinerary, type CityItinerary } from '@/server/queries/city-itinerary'
import { dateForDayIndex, todayUtc } from '@/lib/dates'
import { ok, err, guard, type ActionResult } from '@/lib/action-result'

/** Preview only — reads the catalogue, writes nothing. */
export const previewCityItinerary = guard(
  async (cityId: string, days: number): Promise<ActionResult<CityItinerary>> => {
    await requireUser()
    const itinerary = await getCityItinerary(cityId, days)
    if (!itinerary) return err('We could not find that destination.')
    if (itinerary.activityCount === 0) {
      return err('No activities are catalogued for this destination yet.')
    }
    return ok(itinerary)
  }
)

/**
 * Accepts a previewed plan: one trip, one stop covering it, and every suggested activity
 * filed on its day. The itinerary is re-read here rather than trusted from the client, so a
 * tampered payload cannot invent activities or costs.
 */
export const createTripFromItinerary = guard(
  async (cityId: string, days: number): Promise<ActionResult<{ id: string; name: string }>> => {
    const session = await requireUser()
    const itinerary = await getCityItinerary(cityId, days)
    if (!itinerary) return err('We could not find that destination.')
    if (itinerary.activityCount === 0) {
      return err('No activities are catalogued for this destination yet.')
    }

    // Starts tomorrow: a plausible placeholder the traveller can move in the builder.
    const startDate = dateForDayIndex(todayUtc(), 1)
    const endDate = dateForDayIndex(startDate, itinerary.dayCount - 1)
    const dayLabel = `${itinerary.dayCount} day${itinerary.dayCount === 1 ? '' : 's'}`
    const name = `${dayLabel} in ${itinerary.city.name}`

    const tripId = await db.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          userId: session.id,
          name,
          description: `A ready-made ${dayLabel} plan for ${itinerary.city.name}, ${itinerary.city.country}.`,
          startDate,
          endDate,
          coverUrl: itinerary.city.imageUrl,
          stops: {
            create: { cityId: itinerary.city.id, startDate, endDate, order: 0 },
          },
        },
        select: { id: true, stops: { select: { id: true } } },
      })

      const stopId = trip.stops[0].id
      await tx.tripActivity.createMany({
        data: itinerary.days.flatMap((day) =>
          day.items.map((item, order) => ({
            stopId,
            activityId: item.activityId,
            dayIndex: day.dayIndex,
            startTime: item.startTime,
            cost: item.cost,
            order,
          }))
        ),
      })

      return trip.id
    })

    revalidatePath('/trips')
    revalidatePath('/dashboard')
    return ok({ id: tripId, name })
  }
)
