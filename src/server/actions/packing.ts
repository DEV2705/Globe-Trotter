'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireUser, assertTripOwner } from '@/server/auth'
import { ok, err, guard, type ActionResult } from '@/lib/action-result'
import { isAiConfigured } from '@/server/ai/client'
import { checkRateLimit } from '@/server/ai/rate-limit'
import { generatePackingList } from '@/server/ai/packing'

export const generateTripPackingList = guard(
  async (tripId: string): Promise<ActionResult<undefined>> => {
    const session = await requireUser()
    if (!isAiConfigured()) return err('Packing list generation is not configured on this server.')

    const limit = checkRateLimit(session.id, 'packing')
    if (!limit.allowed) return err(limit.message ?? 'Rate limit reached.')

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        userId: true,
        name: true,
        startDate: true,
        endDate: true,
        stops: {
          orderBy: { order: 'asc' },
          select: {
            city: { select: { name: true, country: true, lat: true } },
            items: { select: { activity: { select: { type: true } } } },
          },
        },
      },
    })
    if (!trip) notFound()
    assertTripOwner(trip, session.id)

    const items = await generatePackingList(trip)
    if (items.length === 0) return err('We could not build a packing list for this trip.')

    // Regenerating replaces the list wholesale, so do it atomically — a failed
    // create after a successful delete would leave the trip with nothing.
    await db.$transaction(async (tx) => {
      await tx.packingList.deleteMany({ where: { tripId } })
      await tx.packingList.create({
        data: {
          tripId,
          items: {
            create: items.map((item, index) => ({
              category: item.category,
              label: item.label,
              qty: item.qty,
              note: item.note ?? null,
              order: index,
            })),
          },
        },
      })
    })

    revalidatePath(`/trips/${tripId}`)
    return ok()
  }
)

export const togglePackingItem = guard(
  async (itemId: string): Promise<ActionResult<{ packed: boolean }>> => {
    const session = await requireUser()

    const item = await db.packingItem.findUnique({
      where: { id: itemId },
      select: { id: true, packed: true, list: { select: { tripId: true, trip: { select: { userId: true } } } } },
    })
    if (!item) notFound()
    assertTripOwner(item.list.trip, session.id)

    const updated = await db.packingItem.update({
      where: { id: itemId },
      data: { packed: !item.packed },
      select: { packed: true },
    })

    revalidatePath(`/trips/${item.list.tripId}`)
    return ok({ packed: updated.packed })
  }
)

export const deletePackingItem = guard(async (itemId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()

  const item = await db.packingItem.findUnique({
    where: { id: itemId },
    select: { id: true, list: { select: { tripId: true, trip: { select: { userId: true } } } } },
  })
  if (!item) notFound()
  assertTripOwner(item.list.trip, session.id)

  await db.packingItem.delete({ where: { id: itemId } })
  revalidatePath(`/trips/${item.list.tripId}`)
  return ok()
})

export const addPackingItem = guard(
  async (tripId: string, label: string, category: string): Promise<ActionResult<undefined>> => {
    const session = await requireUser()

    const trimmed = label.trim()
    if (!trimmed) return err('Give the item a name.')

    const trip = await db.trip.findUnique({ where: { id: tripId }, select: { id: true, userId: true } })
    if (!trip) notFound()
    assertTripOwner(trip, session.id)

    // A traveller can add items before ever generating a list.
    const list = await db.packingList.upsert({
      where: { tripId },
      create: { tripId },
      update: {},
      select: { id: true, items: { select: { order: true }, orderBy: { order: 'desc' }, take: 1 } },
    })

    await db.packingItem.create({
      data: {
        listId: list.id,
        category,
        label: trimmed.slice(0, 80),
        order: (list.items[0]?.order ?? -1) + 1,
      },
    })

    revalidatePath(`/trips/${tripId}`)
    return ok()
  }
)
