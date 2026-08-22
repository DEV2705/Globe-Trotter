import { z } from 'zod'

/**
 * Every model output crosses this boundary before it reaches Prisma.
 * Nothing here trusts the model — ids are re-checked against the catalogue
 * shortlist in `itinerary.ts`, because a syntactically valid cuid is still a
 * foreign-key violation if it was invented.
 */

export const ACTIVITY_TYPES = [
  'SIGHTSEEING',
  'FOOD',
  'ADVENTURE',
  'CULTURE',
  'NATURE',
  'NIGHTLIFE',
  'RELAX',
  'SHOPPING',
] as const

export const PACE = ['relaxed', 'balanced', 'packed'] as const
export type Pace = (typeof PACE)[number]

/** Activities per day, by pace. Applied deterministically — the model is not asked to count. */
export const ACTIVITIES_PER_DAY: Record<Pace, number> = {
  relaxed: 2,
  balanced: 3,
  packed: 4,
}

/** Form input for the generator. */
export const generateItinerarySchema = z.object({
  destination: z.string().trim().min(2, 'Tell us where you want to go.').max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date.'),
  days: z.coerce.number().int().min(1, 'At least 1 day.').max(30, 'Keep it to 30 days or fewer.'),
  budgetCap: z.coerce.number().positive().max(100_000_000).optional(),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  interests: z.array(z.enum(ACTIVITY_TYPES)).max(8).default([]),
  pace: z.enum(PACE).default('balanced'),
})
export type GenerateItineraryInput = z.infer<typeof generateItinerarySchema>

/** Shape of the `propose_itinerary` tool call. */
export const proposedItinerarySchema = z.object({
  tripName: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().max(400).optional(),
  stops: z
    .array(
      z.object({
        cityId: z.string().min(1),
        startDayIndex: z.number().int().min(0),
        endDayIndex: z.number().int().min(0),
        reason: z.string().trim().max(240).default(''),
      })
    )
    .min(1),
  items: z
    .array(
      z.object({
        activityId: z.string().min(1),
        dayIndex: z.number().int().min(0),
        startTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
        note: z.string().trim().max(200).optional(),
      })
    )
    .default([]),
})
export type ProposedItinerary = z.infer<typeof proposedItinerarySchema>

export const PACKING_CATEGORIES = ['Documents', 'Clothing', 'Electronics', 'Health', 'Gear'] as const

export const proposedPackingSchema = z.object({
  items: z
    .array(
      z.object({
        category: z.enum(PACKING_CATEGORIES),
        label: z.string().trim().min(1).max(80),
        qty: z.coerce.number().int().min(1).max(99).default(1),
        note: z.string().trim().max(120).optional(),
      })
    )
    .min(1)
    .max(80),
})
export type ProposedPacking = z.infer<typeof proposedPackingSchema>

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, 'Type a message.').max(2000),
  tripId: z.string().trim().max(40).optional(),
})
