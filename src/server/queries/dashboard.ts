import { db } from '@/server/db'
import { daysUntil, parseDateInput } from '@/lib/dates'
import type { CapStatus } from '@/lib/budget'
import { getTrips, getBudget } from './trips'
import { searchCities } from './catalog'
import type { CityDTO, TripCardDTO } from './types'

export interface DashboardHighlight {
  tripId: string
  tripName: string
  daysRemaining: number
  totalSpend: number
  currency: string
  capStatus: CapStatus
}

export interface DashboardData {
  ongoing: TripCardDTO[]
  upcoming: TripCardDTO[]
  recent: TripCardDTO[]
  topCities: CityDTO[]
  savedCityIds: string[]
  counts: { ongoing: number; upcoming: number; completed: number; total: number }
  highlight: DashboardHighlight | null
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const [{ ongoing, upcoming, completed, all, total }, topCities, savedRows] = await Promise.all([
    getTrips(userId, { sort: 'start-desc' }),
    searchCities({ sortBy: 'popularity' }, { userId, take: 12 }),
    db.savedCity.findMany({ where: { userId }, select: { cityId: true } }),
  ])

  const target = ongoing[0] ?? upcoming[0]
  let highlight: DashboardHighlight | null = null

  if (target) {
    const budget = await getBudget(target.id)
    const daysRemaining =
      target.status === 'ONGOING'
        ? daysUntil(parseDateInput(target.endDate))
        : daysUntil(parseDateInput(target.startDate))

    highlight = {
      tripId: target.id,
      tripName: target.name,
      daysRemaining,
      totalSpend: budget.total,
      currency: budget.currency,
      capStatus: budget.capStatus,
    }
  }

  return {
    ongoing,
    upcoming,
    recent: all.slice(0, 6),
    topCities,
    savedCityIds: savedRows.map((r) => r.cityId),
    counts: { ongoing: ongoing.length, upcoming: upcoming.length, completed: completed.length, total },
    highlight,
  }
}
