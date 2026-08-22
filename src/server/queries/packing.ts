import { db } from '@/server/db'
import type { PackingItemView } from '@/components/trip/packing-list-panel'

/**
 * Read-only boundary for the packing checklist.
 *
 * Ownership is enforced by the caller (the trip page already asserts it before
 * rendering), so this returns an empty list rather than throwing for a trip the
 * viewer cannot see.
 */
export async function getPackingItems(tripId: string): Promise<PackingItemView[]> {
  const list = await db.packingList.findUnique({
    where: { tripId },
    select: {
      items: {
        orderBy: { order: 'asc' },
        select: { id: true, category: true, label: true, qty: true, packed: true, note: true },
      },
    },
  })
  return list?.items ?? []
}
