import 'server-only'
import { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { parseDateInput, dateForDayIndex } from '@/lib/dates'
import type { GeneratedItinerary } from './itinerary'
import type { GenerateItineraryInput } from './schemas'

/**
 * Write a generated plan as an ordinary trip.
 *
 * Everything lands in one transaction — a half-written trip (stops with no
 * activities, or activities pointing at a stop that failed) is worse than no
 * trip at all. After this returns, the result is indistinguishable from a
 * hand-built trip and every existing view operates on it unchanged.
 */
export async function persistGeneratedTrip(
  userId: string,
  input: GenerateItineraryInput,
  plan: GeneratedItinerary
): Promise<string> {
  const startDate = parseDateInput(input.startDate)
  const endDate = dateForDayIndex(startDate, input.days - 1)
  const cityById = new Map(plan.cities.map((c) => [c.id, c]))

  return db.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        userId,
        name: plan.tripName.slice(0, 80),
        description: plan.summary || null,
        startDate,
        endDate,
        budgetCap: input.budgetCap ?? null,
        currency: input.currency,
      },
      select: { id: true },
    })

    const stopIdByCity = new Map<string, string>()
    for (const [index, stop] of plan.stops.entries()) {
      const created = await tx.stop.create({
        data: {
          tripId: trip.id,
          cityId: stop.cityId,
          startDate: dateForDayIndex(startDate, stop.startDayIndex),
          endDate: dateForDayIndex(startDate, stop.endDayIndex),
          order: index,
          notes: stop.reason || null,
        },
        select: { id: true },
      })
      stopIdByCity.set(stop.cityId, created.id)
    }

    if (plan.items.length > 0) {
      await tx.tripActivity.createMany({
        data: plan.items.flatMap((item) => {
          const stopId = stopIdByCity.get(item.cityId)
          if (!stopId) return []
          return [
            {
              stopId,
              activityId: item.activityId,
              dayIndex: item.dayIndex,
              startTime: item.startTime,
              cost: item.cost,
              order: item.order,
              note: item.note ?? null,
            },
          ]
        }),
      })
    }

    // Seed lodging and transport estimates so the budget views have real
    // content the moment the trip opens, rather than an empty chart.
    const expenses: Prisma.ExpenseCreateManyInput[] = plan.stops.flatMap((stop) => {
      const city = cityById.get(stop.cityId)
      if (!city) return []
      const nights = stop.endDayIndex - stop.startDayIndex + 1
      return [
        {
          tripId: trip.id,
          stopId: stopIdByCity.get(stop.cityId) ?? null,
          category: 'STAY',
          label: `Accommodation — ${city.name}`,
          amount: Math.round(city.costIndex * 60 * nights),
          dayIndex: stop.startDayIndex,
        },
      ]
    })

    if (plan.stops.length > 1) {
      expenses.push({
        tripId: trip.id,
        stopId: null,
        category: 'TRANSPORT',
        label: 'Inter-city travel',
        amount: Math.round((plan.stops.length - 1) * 3500),
        dayIndex: 0,
      })
    }

    if (expenses.length > 0) await tx.expense.createMany({ data: expenses })

    return trip.id
  })
}
