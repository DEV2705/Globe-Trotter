'use server'

import { db } from '@/server/db'
import { requireUser } from '@/server/auth'
import { toNumber } from '@/lib/utils'
import { ok, guard, type ActionResult } from '@/lib/action-result'
import type { ActivityType } from '@/server/queries/types'

export interface CuratedActivity {
  id: string
  name: string
  type: ActivityType
  imageUrl: string | null
  durationMin: number
  rating: number
  avgCost: number
}

/** The handful of must-do stops the quick-preview drawer shows, best-rated first. */
export const topCityActivities = guard(
  async (cityId: string, take: number): Promise<ActionResult<CuratedActivity[]>> => {
    await requireUser()

    const rows = await db.activity.findMany({
      where: { cityId },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
      take: Math.min(12, Math.max(1, take)),
      select: {
        id: true,
        name: true,
        type: true,
        imageUrl: true,
        durationMin: true,
        rating: true,
        avgCost: true,
      },
    })

    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type as ActivityType,
        imageUrl: r.imageUrl,
        durationMin: r.durationMin,
        rating: r.rating,
        avgCost: toNumber(r.avgCost),
      }))
    )
  }
)
