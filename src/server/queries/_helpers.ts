/**
 * Internal mapping helpers shared by src/server/queries/*.ts. Not part of the public query API
 * in §8.2 — kept here so every query function serializes Prisma rows into DTOs the same way.
 */
import type { Prisma } from '@prisma/client'
import { toNumber } from '@/lib/utils'
import { dayIndexFor, tripLength, toDateInput, eachDayOfTrip, deriveStatus, utcDay } from '@/lib/dates'
import type {
  ActivityCardDTO,
  ActivityDTO,
  CityDTO,
  ExpenseDTO,
  StopDTO,
  TripActivityDTO,
  TripFullDTO,
} from './types'

type CityRow = {
  id: string
  name: string
  country: string
  region: string
  costIndex: number
  popularity: number
  imageUrl: string | null
  lat: number | null
  lng: number | null
}

export function mapCity(city: CityRow, savedCityIds?: ReadonlySet<string>): CityDTO {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    region: city.region,
    costIndex: city.costIndex,
    popularity: city.popularity,
    imageUrl: city.imageUrl,
    lat: city.lat,
    lng: city.lng,
    saved: savedCityIds ? savedCityIds.has(city.id) : false,
  }
}

type ActivityRow = {
  id: string
  cityId: string
  name: string
  type: string
  description: string
  avgCost: Prisma.Decimal | number
  durationMin: number
  imageUrl: string | null
  rating: number
  city: { name: string }
}

export function mapActivity(activity: ActivityRow): ActivityDTO {
  return {
    id: activity.id,
    cityId: activity.cityId,
    cityName: activity.city.name,
    name: activity.name,
    type: activity.type as ActivityDTO['type'],
    description: activity.description,
    avgCost: toNumber(activity.avgCost),
    durationMin: activity.durationMin,
    imageUrl: activity.imageUrl,
    rating: activity.rating,
  }
}

type ActivityCardRow = ActivityRow & { city: { name: string; country: string } }

export function mapActivityCard(activity: ActivityCardRow): ActivityCardDTO {
  return {
    id: activity.id,
    cityId: activity.cityId,
    cityName: activity.city.name,
    country: activity.city.country,
    name: activity.name,
    type: activity.type as ActivityCardDTO['type'],
    description: activity.description,
    avgCost: toNumber(activity.avgCost),
    durationMin: activity.durationMin,
    imageUrl: activity.imageUrl,
    rating: activity.rating,
  }
}

type TripActivityRow = {
  id: string
  stopId: string
  activityId: string
  dayIndex: number
  startTime: string | null
  cost: Prisma.Decimal | number
  order: number
  note: string | null
  activity: ActivityRow
}

export function mapTripActivity(item: TripActivityRow): TripActivityDTO {
  return {
    id: item.id,
    stopId: item.stopId,
    activityId: item.activityId,
    activity: mapActivity(item.activity),
    dayIndex: item.dayIndex,
    startTime: item.startTime,
    cost: toNumber(item.cost),
    order: item.order,
    note: item.note,
  }
}

type ExpenseRow = {
  id: string
  tripId: string
  stopId: string | null
  category: string
  label: string
  amount: Prisma.Decimal | number
  dayIndex: number | null
}

export function mapExpense(expense: ExpenseRow): ExpenseDTO {
  return {
    id: expense.id,
    tripId: expense.tripId,
    stopId: expense.stopId,
    category: expense.category as ExpenseDTO['category'],
    label: expense.label,
    amount: toNumber(expense.amount),
    dayIndex: expense.dayIndex,
  }
}

type StopRow = {
  id: string
  tripId: string
  cityId: string
  startDate: Date
  endDate: Date
  order: number
  notes: string | null
  city: CityRow
  items: TripActivityRow[]
}

export function mapStop(stop: StopRow, tripStart: Date, savedCityIds?: ReadonlySet<string>): StopDTO {
  return {
    id: stop.id,
    tripId: stop.tripId,
    cityId: stop.cityId,
    city: mapCity(stop.city, savedCityIds),
    startDate: toDateInput(stop.startDate),
    endDate: toDateInput(stop.endDate),
    order: stop.order,
    notes: stop.notes,
    items: stop.items
      .slice()
      .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order)
      .map(mapTripActivity),
    startDayIndex: dayIndexFor(tripStart, stop.startDate),
    endDayIndex: dayIndexFor(tripStart, stop.endDate),
    nights: tripLength(stop.startDate, stop.endDate),
  }
}

type TripRow = {
  id: string
  userId: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  coverUrl: string | null
  budgetCap: Prisma.Decimal | number | null
  currency: string
  isPublic: boolean
  shareSlug: string | null
  copiedFrom: string | null
  viewCount: number
  stops: StopRow[]
  expenses: ExpenseRow[]
}

export function mapTripFull(trip: TripRow): TripFullDTO {
  const start = utcDay(trip.startDate)
  const end = utcDay(trip.endDate)
  return {
    id: trip.id,
    userId: trip.userId,
    name: trip.name,
    description: trip.description,
    startDate: toDateInput(start),
    endDate: toDateInput(end),
    coverUrl: trip.coverUrl,
    budgetCap: trip.budgetCap === null ? null : toNumber(trip.budgetCap),
    currency: trip.currency,
    status: deriveStatus(start, end),
    isPublic: trip.isPublic,
    shareSlug: trip.shareSlug,
    copiedFrom: trip.copiedFrom,
    viewCount: trip.viewCount,
    totalDays: tripLength(start, end),
    dayDates: eachDayOfTrip(start, end).map(toDateInput),
    stops: trip.stops
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => mapStop(s, start)),
    expenses: trip.expenses.map(mapExpense),
  }
}
