'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/auth'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'
import { isAiConfigured } from '@/server/ai/client'
import { checkRateLimit } from '@/server/ai/rate-limit'
import { buildCatalogueShortlist } from '@/server/ai/context'
import { generateItinerary } from '@/server/ai/itinerary'
import { persistGeneratedTrip } from '@/server/ai/persist'
import { generateItinerarySchema } from '@/server/ai/schemas'

export const generateTripFromPrompt = guard(
  async (input: unknown): Promise<ActionResult<{ id: string; notices: string[] }>> => {
    const session = await requireUser()
    if (!isAiConfigured()) return err('Trip generation is not configured on this server.')

    const parsed = generateItinerarySchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const data = parsed.data

    const limit = checkRateLimit(session.id, 'itinerary')
    if (!limit.allowed) return err(limit.message ?? 'Rate limit reached.')

    const shortlist = await buildCatalogueShortlist(data.destination, data.interests)
    if (shortlist.cities.length === 0) {
      return err('We could not find any destinations to plan with. Try a different place.')
    }

    const plan = await generateItinerary(data, shortlist)
    if (plan.stops.length === 0) {
      return err('We could not build an itinerary for that request. Try a broader destination.')
    }

    const tripId = await persistGeneratedTrip(session.id, data, plan)

    revalidatePath('/trips')
    revalidatePath('/dashboard')
    return ok({ id: tripId, notices: plan.notices })
  }
)
