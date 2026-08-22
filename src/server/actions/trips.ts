'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireUser, assertTripOwner } from '@/server/auth'
import { tripSchema } from '@/lib/validators'
import { parseDateInput, tripLength, utcDay } from '@/lib/dates'
import { slugify, shortId } from '@/lib/utils'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'

function clampDateToRange(date: Date, start: Date, end: Date): Date {
  if (date.getTime() < start.getTime()) return start
  if (date.getTime() > end.getTime()) return end
  return date
}

type TripTree = Prisma.TripGetPayload<{
  include: { stops: { include: { items: true } }; expenses: true }
}>

/** Clones a full trip tree (stops → items, expenses) under a new owner with fresh ids. */
async function cloneTripTree(
  tx: Prisma.TransactionClient,
  source: TripTree,
  ownerId: string,
  name: string
): Promise<string> {
  const newTrip = await tx.trip.create({
    data: {
      userId: ownerId,
      name,
      description: source.description,
      startDate: source.startDate,
      endDate: source.endDate,
      coverUrl: source.coverUrl,
      budgetCap: source.budgetCap,
      currency: source.currency,
      isPublic: false,
      copiedFrom: source.id,
    },
    select: { id: true },
  })

  const stopIdMap = new Map<string, string>()
  for (const stop of source.stops) {
    const newStop = await tx.stop.create({
      data: {
        tripId: newTrip.id,
        cityId: stop.cityId,
        startDate: stop.startDate,
        endDate: stop.endDate,
        order: stop.order,
        notes: stop.notes,
      },
      select: { id: true },
    })
    stopIdMap.set(stop.id, newStop.id)

    for (const item of stop.items) {
      await tx.tripActivity.create({
        data: {
          stopId: newStop.id,
          activityId: item.activityId,
          dayIndex: item.dayIndex,
          startTime: item.startTime,
          cost: item.cost,
          order: item.order,
          note: item.note,
        },
      })
    }
  }

  for (const expense of source.expenses) {
    await tx.expense.create({
      data: {
        tripId: newTrip.id,
        stopId: expense.stopId ? (stopIdMap.get(expense.stopId) ?? null) : null,
        category: expense.category,
        label: expense.label,
        amount: expense.amount,
        dayIndex: expense.dayIndex,
      },
    })
  }

  return newTrip.id
}

export const createTrip = guard(async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  const session = await requireUser()
  const parsed = tripSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  const startDate = parseDateInput(data.startDate)
  const endDate = parseDateInput(data.endDate)

  const trip = await db.trip.create({
    data: {
      userId: session.id,
      name: data.name,
      description: data.description,
      startDate,
      endDate,
      coverUrl: data.coverUrl,
      budgetCap: data.budgetCap,
      currency: data.currency,
      ...(data.firstCityId
        ? { stops: { create: { cityId: data.firstCityId, startDate, endDate, order: 0 } } }
        : {}),
    },
    select: { id: true },
  })

  revalidatePath('/trips')
  revalidatePath('/dashboard')
  return ok({ id: trip.id })
})

export const updateTrip = guard(
  async (tripId: string, input: unknown): Promise<ActionResult<undefined>> => {
    const session = await requireUser()
    const parsed = tripSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const data = parsed.data

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: { stops: { include: { items: true } }, expenses: true },
    })
    if (!trip) notFound()
    assertTripOwner(trip, session.id)

    const newStart = parseDateInput(data.startDate)
    const newEnd = parseDateInput(data.endDate)
    const lastDayIndex = tripLength(newStart, newEnd) - 1

    await db.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: tripId },
        data: {
          name: data.name,
          description: data.description,
          startDate: newStart,
          endDate: newEnd,
          coverUrl: data.coverUrl,
          budgetCap: data.budgetCap,
          currency: data.currency,
        },
      })

      // Reconcile (§3.3 / §8.3): clamp, never delete.
      for (const stop of trip.stops) {
        const clampedStart = clampDateToRange(utcDay(stop.startDate), newStart, newEnd)
        const clampedEnd0 = clampDateToRange(utcDay(stop.endDate), newStart, newEnd)
        const clampedEnd = clampedEnd0.getTime() < clampedStart.getTime() ? clampedStart : clampedEnd0

        if (clampedStart.getTime() !== stop.startDate.getTime() || clampedEnd.getTime() !== stop.endDate.getTime()) {
          await tx.stop.update({
            where: { id: stop.id },
            data: { startDate: clampedStart, endDate: clampedEnd },
          })
        }

        for (const item of stop.items) {
          if (item.dayIndex > lastDayIndex) {
            await tx.tripActivity.update({ where: { id: item.id }, data: { dayIndex: lastDayIndex } })
          }
        }
      }

      for (const expense of trip.expenses) {
        if (expense.dayIndex !== null && expense.dayIndex > lastDayIndex) {
          await tx.expense.update({ where: { id: expense.id }, data: { dayIndex: lastDayIndex } })
        }
      }
    })

    revalidatePath(`/trips/${tripId}`)
    revalidatePath(`/trips/${tripId}/build`)
    revalidatePath(`/trips/${tripId}/calendar`)
    revalidatePath('/trips')
    revalidatePath('/dashboard')
    return ok()
  }
)

export const deleteTrip = guard(async (tripId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { userId: true } })
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  await db.trip.delete({ where: { id: tripId } })

  revalidatePath('/trips')
  revalidatePath('/dashboard')
  return ok()
})

export const duplicateTrip = guard(async (tripId: string): Promise<ActionResult<{ id: string }>> => {
  const session = await requireUser()
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { stops: { include: { items: true } }, expenses: true },
  })
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  const newTripId = await db.$transaction((tx) =>
    cloneTripTree(tx, trip, session.id, `${trip.name} (Copy)`)
  )

  revalidatePath('/trips')
  return ok({ id: newTripId })
})

export const publishTrip = guard(async (tripId: string): Promise<ActionResult<{ slug: string }>> => {
  const session = await requireUser()
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { userId: true, name: true, shareSlug: true },
  })
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  // A link already shared keeps working.
  if (trip.shareSlug) {
    await db.trip.update({ where: { id: tripId }, data: { isPublic: true } })
    revalidatePath(`/trips/${tripId}`)
    revalidatePath(`/t/${trip.shareSlug}`)
    return ok({ slug: trip.shareSlug })
  }

  const base = slugify(trip.name)
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = `${base}-${shortId(5)}`
    try {
      await db.trip.update({ where: { id: tripId }, data: { isPublic: true, shareSlug: candidate } })
      revalidatePath(`/trips/${tripId}`)
      revalidatePath(`/t/${candidate}`)
      return ok({ slug: candidate })
    } catch (error) {
      const isUniqueConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      if (!isUniqueConflict) throw error
    }
  }
  return err('Could not generate a unique share link. Please try again.')
})

export const unpublishTrip = guard(async (tripId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { userId: true, shareSlug: true },
  })
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  // Keeps the slug — re-publishing restores the same URL.
  await db.trip.update({ where: { id: tripId }, data: { isPublic: false } })

  revalidatePath(`/trips/${tripId}`)
  if (trip.shareSlug) revalidatePath(`/t/${trip.shareSlug}`)
  return ok()
})

export const copyPublicTrip = guard(async (slug: string): Promise<ActionResult<{ tripId: string }>> => {
  const session = await requireUser()
  const trip = await db.trip.findUnique({
    where: { shareSlug: slug },
    include: { stops: { include: { items: true } }, expenses: true },
  })
  if (!trip || !trip.isPublic) return err('This trip is no longer available to copy.')

  const newTripId = await db.$transaction((tx) => cloneTripTree(tx, trip, session.id, trip.name))

  revalidatePath('/trips')
  return ok({ tripId: newTripId })
})
