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

/**
 * Payer and shares must belong to *this* trip — a client is free to post any id, and a
 * foreign member would corrupt the settlement silently rather than loudly.
 */
async function resolveSharing(
  tripId: string,
  paidById: string | undefined,
  splits: { memberId: string; amount: number }[] | undefined
): Promise<{ paidById: string | null; splits: { memberId: string; amount: number }[] } | string> {
  if (!paidById && !splits?.length) return { paidById: null, splits: [] }

  const members = await db.tripMember.findMany({ where: { tripId }, select: { id: true } })
  const known = new Set(members.map((m) => m.id))

  if (paidById && !known.has(paidById)) return 'That traveller is not on this trip.'
  const cleaned = (splits ?? []).filter((s) => known.has(s.memberId))
  if ((splits?.length ?? 0) > 0 && cleaned.length === 0) {
    return 'None of those travellers are on this trip.'
  }

  return { paidById: paidById ?? null, splits: cleaned }
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

  const sharing = await resolveSharing(data.tripId, data.paidById, data.splits)
  if (typeof sharing === 'string') return err(sharing)

  const expense = await db.expense.create({
    data: {
      tripId: data.tripId,
      stopId: data.stopId ?? null,
      category: data.category,
      label: data.label,
      amount: data.amount,
      dayIndex: data.dayIndex ?? null,
      paidById: sharing.paidById,
      splits: sharing.splits,
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

    const sharing = await resolveSharing(expense.tripId, data.paidById, data.splits)
    if (typeof sharing === 'string') return err(sharing)

    await db.expense.update({
      where: { id: expenseId },
      data: {
        stopId: data.stopId ?? null,
        category: data.category,
        label: data.label,
        amount: data.amount,
        dayIndex: data.dayIndex ?? null,
        paidById: sharing.paidById,
        splits: sharing.splits,
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
