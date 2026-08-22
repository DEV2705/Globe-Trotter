import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { toDateInput, utcDay, todayUtc } from '@/lib/dates'
import type { AdminStats, AdminUserRow } from './types'

export interface GetAdminStatsParams {
  q?: string
  groupBy?: 'none' | 'status'
  filter?: 'all' | 'admins' | 'active' | 'suspended' | 'with-trips'
  sort?: 'recent' | 'trips-desc' | 'name'
}

function sortUsers(users: AdminUserRow[], sort: GetAdminStatsParams['sort']): AdminUserRow[] {
  const sorted = [...users]
  switch (sort) {
    case 'trips-desc':
      return sorted.sort((a, b) => b.tripCount - a.tripCount)
    case 'name':
      return sorted.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
    case 'recent':
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

const DAY_MS = 86_400_000

async function computeTrendsByWeek(): Promise<AdminStats['trendsByWeek']> {
  const today = todayUtc()
  const mondayOffset = (today.getUTCDay() + 6) % 7
  const thisMonday = new Date(today.getTime() - mondayOffset * DAY_MS)

  const weeks: AdminStats['trendsByWeek'] = []
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(thisMonday.getTime() - i * 7 * DAY_MS)
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)
    const [signups, tripsCreated] = await Promise.all([
      db.user.count({ where: { createdAt: { gte: weekStart, lt: weekEnd } } }),
      db.trip.count({ where: { createdAt: { gte: weekStart, lt: weekEnd } } }),
    ])
    weeks.push({ weekStart: toDateInput(weekStart), signups, tripsCreated })
  }
  return weeks
}

async function computeUsersByCountry(): Promise<AdminStats['usersByCountry']> {
  const rows = await db.user.groupBy({ by: ['country'], _count: { country: true } })
  return rows
    .map((r) => ({ country: r.country ?? 'Unknown', count: r._count.country }))
    .sort((a, b) => b.count - a.count)
}

export async function getAdminStats(params: GetAdminStatsParams = {}): Promise<AdminStats> {
  const { q, filter = 'all', sort = 'recent' } = params

  const userWhere: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(filter === 'admins' ? { isAdmin: true } : {}),
    ...(filter === 'active' ? { isActive: true } : {}),
    ...(filter === 'suspended' ? { isActive: false } : {}),
  }

  const usersRaw = await db.user.findMany({
    where: userWhere,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
      isActive: true,
      createdAt: true,
      _count: { select: { trips: true } },
    },
  })

  const users = sortUsers(
    usersRaw
      .filter((u) => (filter === 'with-trips' ? u._count.trips > 0 : true))
      .map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isAdmin: u.isAdmin,
        isActive: u.isActive,
        createdAt: toDateInput(utcDay(u.createdAt)),
        tripCount: u._count.trips,
      })),
    sort
  )

  const [totalUsers, totalTrips, totalPosts, activeUsers] = await Promise.all([
    db.user.count(),
    db.trip.count(),
    db.post.count(),
    db.user.count({ where: { isActive: true } }),
  ])

  const topCitiesRaw = await db.stop.groupBy({
    by: ['cityId'],
    _count: { cityId: true },
    orderBy: { _count: { cityId: 'desc' } },
    take: 10,
  })
  const cityRows = await db.city.findMany({
    where: { id: { in: topCitiesRaw.map((t) => t.cityId) } },
    select: { id: true, name: true, country: true },
  })
  const cityMap = new Map(cityRows.map((c) => [c.id, c]))
  const topCities = topCitiesRaw.map((t) => ({
    cityId: t.cityId,
    name: cityMap.get(t.cityId)?.name ?? '—',
    country: cityMap.get(t.cityId)?.country ?? '—',
    stopCount: t._count.cityId,
  }))

  const topActivitiesRaw = await db.tripActivity.groupBy({
    by: ['activityId'],
    _count: { activityId: true },
    orderBy: { _count: { activityId: 'desc' } },
    take: 10,
  })
  const activityRows = await db.activity.findMany({
    where: { id: { in: topActivitiesRaw.map((t) => t.activityId) } },
    select: { id: true, name: true, city: { select: { name: true } } },
  })
  const activityMap = new Map(activityRows.map((a) => [a.id, a]))
  const topActivities = topActivitiesRaw.map((t) => ({
    activityId: t.activityId,
    name: activityMap.get(t.activityId)?.name ?? '—',
    cityName: activityMap.get(t.activityId)?.city.name ?? '—',
    addCount: t._count.activityId,
  }))

  const [trendsByWeek, usersByCountry] = await Promise.all([computeTrendsByWeek(), computeUsersByCountry()])

  return {
    totals: { users: totalUsers, trips: totalTrips, posts: totalPosts, activeUsers },
    users,
    topCities,
    topActivities,
    trendsByWeek,
    usersByCountry,
  }
}

export async function getAdminUserExport(): Promise<AdminUserRow[]> {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
      isActive: true,
      createdAt: true,
      _count: { select: { trips: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    isAdmin: u.isAdmin,
    isActive: u.isActive,
    createdAt: toDateInput(utcDay(u.createdAt)),
    tripCount: u._count.trips,
  }))
}
