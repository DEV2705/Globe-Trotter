'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireUser, assertTripOwner } from '@/server/auth'
import { expenseSchema } from '@/lib/validators'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}/build`)
  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/calendar`)
}

export const addExpense = guard(async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  const session = await requireUser()
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  const trip = await db.trip.findUnique({ where: { id: data.tripId }, select: { userId: true } })
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  if (data.stopId) {
    const stop = await db.stop.findUnique({ where: { id: data.stopId }, select: { tripId: true } })
    if (!stop || stop.tripId !== data.tripId) return err('That stop does not belong to this trip.')
  }

  const expense = await db.expense.create({
    data: {
      tripId: data.tripId,
      stopId: data.stopId ?? null,
      category: data.category,
      label: data.label,
      amount: data.amount,
      dayIndex: data.dayIndex ?? null,
    },
    select: { id: true },
  })

  revalidateTrip(data.tripId)
  return ok({ id: expense.id })
})

export const updateExpense = guard(
  async (expenseId: string, input: unknown): Promise<ActionResult<undefined>> => {
    const session = await requireUser()
    const parsed = expenseSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const data = parsed.data

    const expense = await db.expense.findUnique({
      where: { id: expenseId },
      include: { trip: { select: { userId: true } } },
    })
    if (!expense) notFound()
    assertTripOwner(expense.trip, session.id)

    if (data.stopId) {
      const stop = await db.stop.findUnique({ where: { id: data.stopId }, select: { tripId: true } })
      if (!stop || stop.tripId !== expense.tripId) return err('That stop does not belong to this trip.')
    }

    await db.expense.update({
      where: { id: expenseId },
      data: {
        stopId: data.stopId ?? null,
        category: data.category,
        label: data.label,
        amount: data.amount,
        dayIndex: data.dayIndex ?? null,
      },
    })

    revalidateTrip(expense.tripId)
    return ok()
  }
)

export const deleteExpense = guard(async (expenseId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const expense = await db.expense.findUnique({
    where: { id: expenseId },
    include: { trip: { select: { userId: true } } },
  })
  if (!expense) notFound()
  assertTripOwner(expense.trip, session.id)

  await db.expense.delete({ where: { id: expenseId } })

  revalidateTrip(expense.tripId)
  return ok()
})
