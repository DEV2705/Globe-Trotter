'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireUser, assertTripOwner } from '@/server/auth'
import { tripMemberSchema } from '@/lib/validators'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/build`)
}

/** Only the trip owner manages the travelling party. */
async function assertOwnsTrip(tripId: string, userId: string) {
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { userId: true } })
  if (!trip) notFound()
  assertTripOwner(trip, userId)
}

export const addTripMember = guard(async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  const session = await requireUser()
  const parsed = tripMemberSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  await assertOwnsTrip(data.tripId, session.id)

  const duplicate = await db.tripMember.findFirst({
    where: { tripId: data.tripId, name: { equals: data.name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (duplicate) {
    return err(`${data.name} is already on this trip.`, { name: 'That name is already in the group.' })
  }

  const member = await db.tripMember.create({
    data: {
      tripId: data.tripId,
      name: data.name,
      email: data.email ?? null,
      avatarUrl: data.avatarUrl ?? null,
    },
    select: { id: true },
  })

  revalidateTrip(data.tripId)
  return ok({ id: member.id })
})

export const removeTripMember = guard(async (memberId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()

  const member = await db.tripMember.findUnique({
    where: { id: memberId },
    select: { tripId: true, name: true, trip: { select: { userId: true } } },
  })
  if (!member) notFound()
  assertTripOwner(member.trip, session.id)

  // Removing a payer would silently rewrite who owes what, so make it an explicit dead end.
  const paidCount = await db.expense.count({ where: { paidById: memberId } })
  if (paidCount > 0) {
    return err(
      `${member.name} paid for ${paidCount} expense${paidCount === 1 ? '' : 's'} — reassign or delete those first.`
    )
  }

  await db.tripMember.delete({ where: { id: memberId } })

  // Their shares would otherwise linger in the JSON and skew every later settlement.
  const expenses = await db.expense.findMany({
    where: { tripId: member.tripId },
    select: { id: true, splits: true },
  })
  for (const expense of expenses) {
    if (!Array.isArray(expense.splits)) continue
    const kept = expense.splits.filter(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        !Array.isArray(s) &&
        (s as { memberId?: unknown }).memberId !== memberId
    )
    if (kept.length !== expense.splits.length) {
      await db.expense.update({ where: { id: expense.id }, data: { splits: kept } })
    }
  }

  revalidateTrip(member.tripId)
  return ok()
})
