import 'server-only'
import { groq, MODELS, TIMEOUT_MS, withRetry } from './client'
import { proposedPackingSchema, PACKING_CATEGORIES, type ProposedPacking } from './schemas'
import { tripLength, formatDay } from '@/lib/dates'

interface PackingTripContext {
  name: string
  startDate: Date
  endDate: Date
  stops: {
    city: { name: string; country: string; lat: number | null }
    items: { activity: { type: string } }[]
  }[]
}

/**
 * Season from month and hemisphere. A July trip to Bali and a July trip to
 * Sydney need opposite wardrobes, and latitude is the only thing that tells
 * them apart.
 */
function seasonFor(month: number, lat: number | null): string {
  const southern = typeof lat === 'number' && lat < 0
  const northernSeasons = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']
  const season = northernSeasons[month]
  if (!southern) return season
  const flip: Record<string, string> = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }
  return flip[season] ?? season
}

function buildPrompt(trip: PackingTripContext): string {
  const days = tripLength(trip.startDate, trip.endDate)
  const month = trip.startDate.getUTCMonth()

  const destinations = trip.stops.map((s) => {
    const season = seasonFor(month, s.city.lat)
    return `${s.city.name}, ${s.city.country} (${season})`
  })

  const activityTypes = [
    ...new Set(trip.stops.flatMap((s) => s.items.map((i) => i.activity.type.toLowerCase()))),
  ]

  return [
    `Trip: ${trip.name}`,
    `Dates: ${formatDay(trip.startDate)} to ${formatDay(trip.endDate)} (${days} days)`,
    `Destinations: ${destinations.join('; ') || 'not yet chosen'}`,
    `Planned activity types: ${activityTypes.join(', ') || 'general sightseeing'}`,
    '',
    `Build a packing checklist for exactly this trip. Scale quantities to ${days} days.`,
    'Tailor it to the destinations, the season shown for each, and the planned activities —',
    'adventure trips need different gear from city breaks. Skip anything irrelevant.',
    '',
    'Return between 20 and 30 items in total. Keep notes under eight words.',
  ].join('\n')
}

const TOOL = {
  type: 'function' as const,
  function: {
    name: 'propose_packing_list',
    description: 'Return a packing checklist tailored to the trip.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: [...PACKING_CATEGORIES] },
              label: { type: 'string', description: 'The item, e.g. "Quick-dry shirts".' },
              qty: { type: 'integer', description: 'How many to bring.' },
              note: { type: 'string', description: 'Optional short reason or tip.' },
            },
            required: ['category', 'label', 'qty'],
          },
        },
      },
      required: ['items'],
    },
  },
}

/**
 * Recover complete item objects from a truncated tool call.
 *
 * The cut always lands mid-object, so every `{...}` that closed before the
 * truncation point is still valid and worth keeping.
 */
function salvage(failedGeneration: string): ProposedPacking['items'] {
  const objects = failedGeneration.match(/\{[^{}]*"label"[^{}]*\}/g)
  if (!objects) return []

  const items: ProposedPacking['items'] = []
  for (const chunk of objects) {
    try {
      const parsed = proposedPackingSchema.shape.items.element.safeParse(JSON.parse(chunk))
      if (parsed.success) items.push(parsed.data)
    } catch {
      // Ignore the fragment that straddles the truncation point.
    }
  }
  return items
}

export async function generatePackingList(trip: PackingTripContext): Promise<ProposedPacking['items']> {
  const completion = await withRetry(() =>
    groq().chat.completions.create(
      {
        model: MODELS.packing,
        temperature: 0.3,
        // Generous: a 30-item list with notes runs well past 2k tokens, and a
        // truncated tool call is unparseable JSON rather than a partial list.
        max_tokens: 6000,
        reasoning_effort: 'low',
        messages: [
          {
            role: 'system',
            content:
              'You are a seasoned traveller writing packing checklists. Be specific and practical. ' +
              'Never pad the list with obvious filler. Call propose_packing_list exactly once.',
          },
          { role: 'user', content: buildPrompt(trip) },
        ],
        tools: [TOOL],
        tool_choice: { type: 'function', function: { name: 'propose_packing_list' } },
      },
      { timeout: TIMEOUT_MS.generate }
    )
  ).catch((error: unknown) => {
    // Groq rejects a truncated tool call outright. Recover the partial JSON
    // where possible rather than losing an otherwise good list.
    const detail = (error as { error?: { error?: { code?: string; failed_generation?: string } } })?.error?.error
    if (detail?.code === 'tool_use_failed') return { failed: detail.failed_generation ?? '' }
    throw error
  })

  if ('failed' in completion) return salvage(completion.failed)

  const raw = completion.choices[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!raw) return []

  try {
    const parsed = proposedPackingSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.items : []
  } catch {
    return []
  }
}
