'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireUser, assertTripOwner, assertStopOwner } from '@/server/auth'
import { reorderSchema, stopSchema, stopUpdateSchema } from '@/lib/validators'
import { parseDateInput, dayIndexFor, utcDay } from '@/lib/dates'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'

/** Trip-bounds and neighbour-overlap validation shared by addStop/updateStop. */
async function validateStopWindow(
  tripId: string,
  startDate: Date,
  endDate: Date,
  excludeStopId?: string
): Promise<string | null> {
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true, endDate: true } })
  if (!trip) return 'Trip not found.'

  if (startDate.getTime() < trip.startDate.getTime() || endDate.getTime() > trip.endDate.getTime()) {
    return 'Stop dates must fall within the trip dates.'
  }

  const siblings = await db.stop.findMany({
    where: { tripId, ...(excludeStopId ? { id: { not: excludeStopId } } : {}) },
    select: { startDate: true, endDate: true, city: { select: { name: true } } },
  })

  const overlap = siblings.find(
    (s) => s.startDate.getTime() < endDate.getTime() && s.endDate.getTime() > startDate.getTime()
  )
  if (overlap) return `Dates overlap with ${overlap.city.name}.`

  return null
}

export const addStop = guard(async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  const session = await requireUser()
  const parsed = stopSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  const trip = await db.trip.findUnique({ where: { id: data.tripId }, select: { userId: true } })
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  const startDate = parseDateInput(data.startDate)
  const endDate = parseDateInput(data.endDate)

  const validationError = await validateStopWindow(data.tripId, startDate, endDate)
  if (validationError) return err(validationError, { startDate: validationError })

  const maxOrder = await db.stop.aggregate({ where: { tripId: data.tripId }, _max: { order: true } })
  const order = (maxOrder._max.order ?? -1) + 1

  const stop = await db.stop.create({
    data: { tripId: data.tripId, cityId: data.cityId, startDate, endDate, order, notes: data.notes },
    select: { id: true },
  })

  revalidatePath(`/trips/${data.tripId}/build`)
  revalidatePath(`/trips/${data.tripId}`)
  return ok({ id: stop.id })
})

export const updateStop = guard(async (input: unknown): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const parsed = stopUpdateSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  const stop = await db.stop.findUnique({
    where: { id: data.stopId },
    include: { trip: { select: { userId: true, startDate: true } }, items: true },
  })
  if (!stop) notFound()
  assertStopOwner(stop, session.id)

  const startDate = parseDateInput(data.startDate)
  const endDate = parseDateInput(data.endDate)

  const validationError = await validateStopWindow(stop.tripId, startDate, endDate, stop.id)
  if (validationError) return err(validationError, { startDate: validationError })

  const tripStart = utcDay(stop.trip.startDate)
  const newStartDayIndex = dayIndexFor(tripStart, startDate)
  const newEndDayIndex = dayIndexFor(tripStart, endDate)

  await db.$transaction(async (tx) => {
    await tx.stop.update({ where: { id: stop.id }, data: { startDate, endDate, notes: data.notes } })

    // Activities that fall outside the stop's new window are pulled back onto its first day.
    for (const item of stop.items) {
      if (item.dayIndex < newStartDayIndex || item.dayIndex > newEndDayIndex) {
        await tx.tripActivity.update({ where: { id: item.id }, data: { dayIndex: newStartDayIndex } })
      }
    }
  })

  revalidatePath(`/trips/${stop.tripId}/build`)
  revalidatePath(`/trips/${stop.tripId}`)
  return ok()
})

export const deleteStop = guard(async (stopId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const stop = await db.stop.findUnique({
    where: { id: stopId },
    include: { trip: { select: { userId: true } } },
  })
  if (!stop) notFound()
  assertStopOwner(stop, session.id)

  await db.$transaction(async (tx) => {
    await tx.stop.delete({ where: { id: stopId } })

    // Re-pack remaining order values so the next insert cannot collide.
    const remaining = await tx.stop.findMany({ where: { tripId: stop.tripId }, orderBy: { order: 'asc' } })
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) {
        await tx.stop.update({ where: { id: remaining[i].id }, data: { order: i } })
      }
    }
  })

  revalidatePath(`/trips/${stop.tripId}/build`)
  revalidatePath(`/trips/${stop.tripId}`)
  return ok()
})

export const reorderStops = guard(async (input: unknown): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const { tripId, order } = parsed.data

  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { userId: true } })
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  // Whole array in one transaction — a partial failure must never leave the list half-sorted.
  await db.$transaction(
    order.map((stopId, index) => db.stop.update({ where: { id: stopId }, data: { order: index } }))
  )

  revalidatePath(`/trips/${tripId}/build`)
  return ok()
})
