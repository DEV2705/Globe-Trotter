'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireUser, assertStopOwner, assertTripActivityOwner } from '@/server/auth'
import { addActivitySchema, reorderActivitiesSchema, updateTripActivitySchema } from '@/lib/validators'
import { dayIndexFor, utcDay } from '@/lib/dates'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}/build`)
  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/calendar`)
}

export const addActivityToStop = guard(
  async (input: unknown): Promise<ActionResult<{ id: string }>> => {
    const session = await requireUser()
    const parsed = addActivitySchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const data = parsed.data

    const stop = await db.stop.findUnique({
      where: { id: data.stopId },
      include: { trip: { select: { userId: true, startDate: true } } },
    })
    if (!stop) notFound()
    assertStopOwner(stop, session.id)

    const activity = await db.activity.findUnique({ where: { id: data.activityId }, select: { avgCost: true } })
    if (!activity) return err('Activity not found.')

    const tripStart = utcDay(stop.trip.startDate)
    const startDayIndex = dayIndexFor(tripStart, stop.startDate)
    const endDayIndex = dayIndexFor(tripStart, stop.endDate)
    // A day picker must never be able to file an activity on a day that city is not being visited.
    const dayIndex = Math.min(Math.max(data.dayIndex ?? startDayIndex, startDayIndex), endDayIndex)

    const maxOrder = await db.tripActivity.aggregate({
      where: { stopId: data.stopId, dayIndex },
      _max: { order: true },
    })

    const item = await db.tripActivity.create({
      data: {
        stopId: data.stopId,
        activityId: data.activityId,
        dayIndex,
        startTime: data.startTime,
        cost: data.cost ?? activity.avgCost, // snapshot unless an explicit cost is passed
        order: (maxOrder._max.order ?? -1) + 1,
      },
      select: { id: true },
    })

    revalidateTrip(stop.tripId)
    return ok({ id: item.id })
  }
)

export const updateTripActivity = guard(async (input: unknown): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const parsed = updateTripActivitySchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  const item = await db.tripActivity.findUnique({
    where: { id: data.id },
    include: { stop: { include: { trip: { select: { userId: true, startDate: true } } } } },
  })
  if (!item) notFound()
  assertTripActivityOwner(item, session.id)

  let dayIndex = item.dayIndex
  if (data.dayIndex !== undefined) {
    const tripStart = utcDay(item.stop.trip.startDate)
    const startDayIndex = dayIndexFor(tripStart, item.stop.startDate)
    const endDayIndex = dayIndexFor(tripStart, item.stop.endDate)
    dayIndex = Math.min(Math.max(data.dayIndex, startDayIndex), endDayIndex)
  }

  await db.tripActivity.update({
    where: { id: data.id },
    data: {
      dayIndex,
      ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
      ...(data.cost !== undefined ? { cost: data.cost } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    },
  })

  revalidateTrip(item.stop.tripId)
  return ok()
})

export const removeTripActivity = guard(async (itemId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const item = await db.tripActivity.findUnique({
    where: { id: itemId },
    include: { stop: { include: { trip: { select: { userId: true } } } } },
  })
  if (!item) notFound()
  assertTripActivityOwner(item, session.id)

  await db.tripActivity.delete({ where: { id: itemId } })

  revalidateTrip(item.stop.tripId)
  return ok()
})

export const reorderActivities = guard(async (input: unknown): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const parsed = reorderActivitiesSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const { stopId, dayIndex, order } = parsed.data

  const stop = await db.stop.findUnique({
    where: { id: stopId },
    include: { trip: { select: { userId: true } } },
  })
  if (!stop) notFound()
  assertStopOwner(stop, session.id)

  // Scope each write to the stop (and day) being reordered so ids from another
  // stop — or another user's trip — no-op instead of being renumbered.
  await db.$transaction(
    order.map((itemId, index) =>
      db.tripActivity.updateMany({
        where: { id: itemId, stopId, dayIndex },
        data: { order: index },
      })
    )
  )

  revalidateTrip(stop.tripId)
  return ok()
})

export const moveActivityToDay = guard(
  async (itemId: string, dayIndex: number): Promise<ActionResult<undefined>> => {
    const session = await requireUser()
    if (!Number.isInteger(dayIndex) || dayIndex < 0) return err('That is not a valid day.')

    const item = await db.tripActivity.findUnique({
      where: { id: itemId },
      include: {
        stop: {
          include: { trip: { select: { userId: true, startDate: true } }, city: { select: { name: true } } },
        },
      },
    })
    if (!item) notFound()
    assertTripActivityOwner(item, session.id)

    const tripStart = utcDay(item.stop.trip.startDate)
    const startDayIndex = dayIndexFor(tripStart, item.stop.startDate)
    const endDayIndex = dayIndexFor(tripStart, item.stop.endDate)
    // Reject rather than clamp: silently snapping the day back reported success while
    // discarding the move, so the UI showed it until the next reload.
    if (dayIndex < startDayIndex || dayIndex > endDayIndex) {
      return err(
        `This activity belongs to your ${item.stop.city.name} stop (Days ${startDayIndex + 1}–${endDayIndex + 1}).`
      )
    }

    const maxOrder = await db.tripActivity.aggregate({
      where: { stopId: item.stopId, dayIndex },
      _max: { order: true },
    })

    await db.tripActivity.update({
      where: { id: itemId },
      data: { dayIndex, order: (maxOrder._max.order ?? -1) + 1 },
    })

    revalidateTrip(item.stop.tripId)
    return ok()
  }
)

export const addActivityFromExplore = guard(
  async (activityId: string, stopId: string, dayIndex?: number): Promise<ActionResult<{ id: string }>> => {
    return addActivityToStop({ stopId, activityId, dayIndex })
  }
)
