/**
 * DTO shapes returned by src/server/queries/*.ts — the serialization boundary
 * (GLOBETROTTER_MASTER_PLAN.md §3.1). Everything here is a plain number or a "yyyy-MM-dd"
 * string. Nothing above src/server/queries/ knows Prisma exists, so these types are defined
 * with local literal unions instead of importing @prisma/client.
 */

export type Category = 'TRANSPORT' | 'STAY' | 'ACTIVITY' | 'MEAL' | 'OTHER'
export type ActivityType =
  | 'SIGHTSEEING'
  | 'FOOD'
  | 'ADVENTURE'
  | 'CULTURE'
  | 'NATURE'
  | 'NIGHTLIFE'
  | 'RELAX'
  | 'SHOPPING'
export type DerivedTripStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED'

export interface CityDTO {
  id: string
  name: string
  country: string
  region: string
  costIndex: number
  popularity: number
  imageUrl: string | null
  lat: number | null
  lng: number | null
  saved: boolean
}

export interface ActivityDTO {
  id: string
  cityId: string
  cityName: string
  name: string
  type: ActivityType
  description: string
  avgCost: number
  durationMin: number
  imageUrl: string | null
  rating: number
}

export interface ActivityCardDTO {
  id: string
  cityId: string
  cityName: string
  country: string
  name: string
  type: ActivityType
  description: string
  avgCost: number
  durationMin: number
  imageUrl: string | null
  rating: number
}

export interface TripActivityDTO {
  id: string
  stopId: string
  activityId: string
  activity: ActivityDTO
  dayIndex: number
  startTime: string | null
  cost: number
  order: number
  note: string | null
}

export interface StopDTO {
  id: string
  tripId: string
  cityId: string
  city: CityDTO
  startDate: string
  endDate: string
  order: number
  notes: string | null
  items: TripActivityDTO[]
  startDayIndex: number
  endDayIndex: number
  nights: number
}

export interface ExpenseDTO {
  id: string
  tripId: string
  stopId: string | null
  category: Category
  label: string
  amount: number
  dayIndex: number | null
}

export interface TripFullDTO {
  id: string
  userId: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  coverUrl: string | null
  budgetCap: number | null
  currency: string
  status: DerivedTripStatus
  isPublic: boolean
  shareSlug: string | null
  copiedFrom: string | null
  viewCount: number
  totalDays: number
  dayDates: string[]
  stops: StopDTO[]
  expenses: ExpenseDTO[]
}

export interface TripCardDTO {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  coverUrl: string | null
  status: DerivedTripStatus
  isPublic: boolean
  shareSlug: string | null
  stopCount: number
  cityNames: string[]
  totalCost: number
  budgetCap: number | null
  currency: string
}

export interface TripOption {
  id: string
  name: string
  stops: { id: string; cityName: string; startDayIndex: number; endDayIndex: number }[]
}

export interface PostDTO {
  id: string
  userId: string
  authorName: string
  authorPhotoUrl: string | null
  tripId: string | null
  tripName: string | null
  title: string
  body: string
  imageUrl: string | null
  tags: string[]
  likes: number
  createdAt: string
}

export interface AdminUserRow {
  id: string
  email: string
  firstName: string
  lastName: string
  isAdmin: boolean
  isActive: boolean
  createdAt: string
  tripCount: number
}

export interface AdminStats {
  totals: {
    users: number
    trips: number
    posts: number
    activeUsers: number
  }
  users: AdminUserRow[]
  topCities: { cityId: string; name: string; country: string; stopCount: number }[]
  topActivities: { activityId: string; name: string; cityName: string; addCount: number }[]
  trendsByWeek: { weekStart: string; signups: number; tripsCreated: number }[]
  usersByCountry: { country: string; count: number }[]
}
