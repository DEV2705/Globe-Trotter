import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { mapCity, mapActivity, mapActivityCard } from './_helpers'
import type { ActivityCardDTO, ActivityDTO, ActivityType, CityDTO } from './types'

async function savedCityIdSet(userId: string): Promise<Set<string>> {
  const rows = await db.savedCity.findMany({ where: { userId }, select: { cityId: true } })
  return new Set(rows.map((r) => r.cityId))
}

export interface SearchCitiesParams {
  q?: string
  region?: string
  country?: string
  maxCostIndex?: number
  sortBy?: 'popularity' | 'cost' | 'name'
  groupBy?: 'none' | 'region'
}

function cityOrderBy(sortBy: SearchCitiesParams['sortBy']): Prisma.CityOrderByWithRelationInput {
  switch (sortBy) {
    case 'cost':
      return { costIndex: 'asc' }
    case 'name':
      return { name: 'asc' }
    case 'popularity':
    default:
      return { popularity: 'desc' }
  }
}

export async function searchCities(
  params: SearchCitiesParams = {},
  opts: { userId?: string; take?: number } = {}
): Promise<CityDTO[]> {
  const { q, region, country, maxCostIndex, sortBy = 'popularity', groupBy = 'none' } = params
  const { userId, take = 60 } = opts

  const cities = await db.city.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { country: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(region ? { region } : {}),
      ...(country ? { country } : {}),
      ...(maxCostIndex !== undefined ? { costIndex: { lte: maxCostIndex } } : {}),
    },
    orderBy: groupBy === 'region' ? [{ region: 'asc' }, cityOrderBy(sortBy)] : cityOrderBy(sortBy),
    take,
  })

  const savedCityIds = userId ? await savedCityIdSet(userId) : undefined
  return cities.map((c) => mapCity(c, savedCityIds))
}

export async function getCity(cityId: string, userId?: string): Promise<CityDTO | null> {
  const city = await db.city.findUnique({ where: { id: cityId } })
  if (!city) return null
  const savedCityIds = userId ? await savedCityIdSet(userId) : undefined
  return mapCity(city, savedCityIds)
}

export interface SearchActivitiesParams {
  q?: string
  cityId?: string
  type?: ActivityType
  region?: string
  country?: string
  maxCost?: number
  maxDuration?: number
  maxCostIndex?: number
  sortBy?: 'popularity' | 'cost' | 'duration' | 'name'
  groupBy?: 'none' | 'city' | 'type'
}

function activityOrderBy(sortBy: SearchActivitiesParams['sortBy']): Prisma.ActivityOrderByWithRelationInput {
  switch (sortBy) {
    case 'cost':
      return { avgCost: 'asc' }
    case 'duration':
      return { durationMin: 'asc' }
    case 'name':
      return { name: 'asc' }
    case 'popularity':
    default:
      return { rating: 'desc' }
  }
}

export async function searchActivities(
  params: SearchActivitiesParams = {},
  opts: { take?: number } = {}
): Promise<ActivityCardDTO[]> {
  const {
    q,
    cityId,
    type,
    region,
    country,
    maxCost,
    maxDuration,
    maxCostIndex,
    sortBy = 'popularity',
    groupBy = 'none',
  } = params
  const { take = 60 } = opts

  const hasCityFilter = region !== undefined || country !== undefined || maxCostIndex !== undefined

  const activities = await db.activity.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(cityId ? { cityId } : {}),
      ...(type ? { type } : {}),
      ...(maxCost !== undefined ? { avgCost: { lte: maxCost } } : {}),
      ...(maxDuration !== undefined ? { durationMin: { lte: maxDuration } } : {}),
      ...(hasCityFilter
        ? {
            city: {
              ...(region ? { region } : {}),
              ...(country ? { country } : {}),
              ...(maxCostIndex !== undefined ? { costIndex: { lte: maxCostIndex } } : {}),
            },
          }
        : {}),
    },
    include: { city: true },
    orderBy:
      groupBy === 'city'
        ? [{ city: { name: 'asc' } }, activityOrderBy(sortBy)]
        : groupBy === 'type'
          ? [{ type: 'asc' }, activityOrderBy(sortBy)]
          : activityOrderBy(sortBy),
    take,
  })

  return activities.map(mapActivityCard)
}

export async function getActivity(id: string): Promise<ActivityDTO | null> {
  const activity = await db.activity.findUnique({ where: { id }, include: { city: true } })
  if (!activity) return null
  return mapActivity(activity)
}

export async function getCatalogFacets(): Promise<{ regions: string[]; countries: string[] }> {
  const [regions, countries] = await Promise.all([
    db.city.findMany({ distinct: ['region'], select: { region: true }, orderBy: { region: 'asc' } }),
    db.city.findMany({ distinct: ['country'], select: { country: true }, orderBy: { country: 'asc' } }),
  ])
  return { regions: regions.map((r) => r.region), countries: countries.map((c) => c.country) }
}

export interface CityOption {
  id: string
  name: string
  country: string
  region: string
  costIndex: number
}

export async function getCityOptions(): Promise<CityOption[]> {
  return db.city.findMany({
    select: { id: true, name: true, country: true, region: true, costIndex: true },
    orderBy: { name: 'asc' },
  })
}

export async function getSavedCities(userId: string): Promise<CityDTO[]> {
  const saved = await db.savedCity.findMany({ where: { userId }, include: { city: true } })
  const savedCityIds = new Set(saved.map((s) => s.cityId))
  return saved.map((s) => mapCity(s.city, savedCityIds))
}
