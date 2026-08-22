import { z } from 'zod'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Normalises an empty optional string to `undefined`, so the DB stores `null` rather than `''`. */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const dateString = z
  .string()
  .regex(DATE_RE, 'Use YYYY-MM-DD')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), 'Not a valid date')

const email = z
  .string()
  .trim()
  .toLowerCase()
  .regex(EMAIL_RE, 'Enter a valid email address')

const password = z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    email,
    phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    country: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    bio: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
    photoUrl: z.preprocess(emptyToUndefined, z.string().optional()),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterInput = z.infer<typeof registerSchema>

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  country: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  bio: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  photoUrl: z.preprocess(emptyToUndefined, z.string().optional()),
  language: z.string().trim().min(2).max(10),
})
export type ProfileInput = z.infer<typeof profileSchema>

export const tripSchema = z
  .object({
    name: z.string().trim().min(1, 'Trip name is required').max(120),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
    startDate: dateString,
    endDate: dateString,
    coverUrl: z.preprocess(emptyToUndefined, z.string().optional()),
    budgetCap: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number().positive('Budget must be greater than 0').optional()
    ),
    currency: z.string().trim().length(3).default('INR'),
    firstCityId: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      const days =
        (new Date(`${data.endDate}T00:00:00Z`).getTime() -
          new Date(`${data.startDate}T00:00:00Z`).getTime()) /
          86_400_000 +
        1
      return days <= 365
    },
    { message: 'Trips are capped at 365 days', path: ['endDate'] }
  )
export type TripInput = z.infer<typeof tripSchema>

export const stopSchema = z
  .object({
    tripId: z.string().min(1),
    cityId: z.string().min(1, 'Select a city'),
    startDate: dateString,
    endDate: dateString,
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
export type StopInput = z.infer<typeof stopSchema>

export const stopUpdateSchema = z
  .object({
    stopId: z.string().min(1),
    startDate: dateString,
    endDate: dateString,
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
export type StopUpdateInput = z.infer<typeof stopUpdateSchema>

export const reorderSchema = z.object({
  tripId: z.string().min(1),
  order: z.array(z.string().min(1)).min(1),
})
export type ReorderInput = z.infer<typeof reorderSchema>

export const addActivitySchema = z.object({
  stopId: z.string().min(1),
  activityId: z.string().min(1),
  dayIndex: z.number().int().min(0).optional(),
  startTime: z.preprocess(
    emptyToUndefined,
    z.string().regex(TIME_RE, 'Use HH:MM').optional()
  ),
  cost: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
})
export type AddActivityInput = z.infer<typeof addActivitySchema>

export const updateTripActivitySchema = z.object({
  id: z.string().min(1),
  dayIndex: z.number().int().min(0).optional(),
  startTime: z.preprocess(emptyToUndefined, z.string().regex(TIME_RE, 'Use HH:MM').optional()),
  cost: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
})
export type UpdateTripActivityInput = z.infer<typeof updateTripActivitySchema>

export const reorderActivitiesSchema = z.object({
  stopId: z.string().min(1),
  dayIndex: z.number().int().min(0),
  order: z.array(z.string().min(1)).min(1),
})
export type ReorderActivitiesInput = z.infer<typeof reorderActivitiesSchema>

/** One traveller's share of an expense. */
export const expenseSplitSchema = z.object({
  memberId: z.string().min(1),
  amount: z.preprocess((v) => Number(v), z.number().min(0)),
})

export const expenseSchema = z.object({
  tripId: z.string().min(1),
  stopId: z.preprocess(emptyToUndefined, z.string().optional()),
  category: z.enum(['TRANSPORT', 'STAY', 'ACTIVITY', 'MEAL', 'OTHER']),
  label: z.string().trim().min(1, 'Label is required').max(120),
  amount: z.preprocess((v) => Number(v), z.number().positive('Amount must be greater than 0')),
  dayIndex: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).optional()
  ),
  // Absent means the expense is budgeted but not shared — it stays out of the settlement.
  paidById: z.preprocess(emptyToUndefined, z.string().optional()),
  // Absent means "split equally between everyone".
  splits: z.array(expenseSplitSchema).optional(),
})
export type ExpenseInput = z.infer<typeof expenseSchema>

export const tripMemberSchema = z.object({
  tripId: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.preprocess(emptyToUndefined, z.string().email('Enter a valid email').optional()),
  avatarUrl: z.preprocess(emptyToUndefined, z.string().optional()),
})
export type TripMemberInput = z.infer<typeof tripMemberSchema>

export const postSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  body: z.string().trim().min(1, 'Say something about your trip').max(4000),
  imageUrl: z.preprocess(emptyToUndefined, z.string().optional()),
  tripId: z.preprocess(emptyToUndefined, z.string().optional()),
  tags: z.preprocess((v) => {
    if (typeof v !== 'string') return []
    return v
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 6)
  }, z.array(z.string()).max(6)),
})
export type PostInput = z.infer<typeof postSchema>

// ---- search-param schemas ----

export const citySearchSchema = z.object({
  q: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  maxCostIndex: z.coerce.number().int().min(0).max(100).optional(),
  groupBy: z.enum(['none', 'region']).default('none'),
  sortBy: z.enum(['popularity', 'cost', 'name']).default('popularity'),
})
export type CitySearchInput = z.infer<typeof citySearchSchema>

export const activitySearchSchema = z.object({
  q: z.string().optional(),
  cityId: z.string().optional(),
  type: z
    .enum(['SIGHTSEEING', 'FOOD', 'ADVENTURE', 'CULTURE', 'NATURE', 'NIGHTLIFE', 'RELAX', 'SHOPPING'])
    .optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  maxCost: z.coerce.number().min(0).optional(),
  maxDuration: z.coerce.number().int().min(0).optional(),
  maxCostIndex: z.coerce.number().int().min(0).max(100).optional(),
  groupBy: z.enum(['none', 'city', 'type']).default('none'),
  sortBy: z.enum(['popularity', 'cost', 'duration', 'name']).default('popularity'),
})
export type ActivitySearchInput = z.infer<typeof activitySearchSchema>

export const tripListSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['ONGOING', 'UPCOMING', 'COMPLETED']).optional(),
  groupBy: z.enum(['status', 'none', 'month']).default('status'),
  sort: z.enum(['start-desc', 'start-asc', 'name', 'cost']).default('start-desc'),
})
export type TripListInput = z.infer<typeof tripListSchema>

export const communitySearchSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  groupBy: z.enum(['none', 'tag']).default('none'),
  sort: z.enum(['recent', 'likes']).default('recent'),
})
export type CommunitySearchInput = z.infer<typeof communitySearchSchema>

export const adminSearchSchema = z.object({
  q: z.string().optional(),
  groupBy: z.enum(['none', 'status']).default('none'),
  filter: z.enum(['all', 'admins', 'active', 'suspended', 'with-trips']).default('all'),
  sort: z.enum(['recent', 'trips-desc', 'name']).default('recent'),
})
export type AdminSearchInput = z.infer<typeof adminSearchSchema>
