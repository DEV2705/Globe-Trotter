import 'server-only'
import { groq, MODELS, TIMEOUT_MS, withRetry } from './client'
import { renderShortlist, fetchActivitiesForCities, type CatalogueShortlist } from './context'
import { proposedItinerarySchema, ACTIVITIES_PER_DAY, type GenerateItineraryInput } from './schemas'
import { planItinerary, type Plan, type Proposal, type ShortlistCity, type ShortlistActivity } from '@/lib/itinerary-plan'

const TOOL = {
  type: 'function' as const,
  function: {
    name: 'propose_itinerary',
    description: 'Propose a day-by-day itinerary using only ids from the supplied catalogue.',
    parameters: {
      type: 'object',
      properties: {
        tripName: { type: 'string', description: 'Short, evocative trip name. Max 80 chars.' },
        summary: { type: 'string', description: 'One or two sentences describing the trip.' },
        stops: {
          type: 'array',
          description: 'Cities in travel order. Ranges must not overlap and must cover every day.',
          items: {
            type: 'object',
            properties: {
              cityId: { type: 'string', description: 'Must be an id from the CITIES list, e.g. c3.' },
              startDayIndex: { type: 'integer', description: '0-based first day in this city.' },
              endDayIndex: { type: 'integer', description: '0-based last day in this city.' },
              reason: { type: 'string', description: 'Why this city, in one short sentence.' },
            },
            required: ['cityId', 'startDayIndex', 'endDayIndex', 'reason'],
          },
        },
        items: {
          type: 'array',
          description: 'Scheduled activities. Each must sit on a day when the traveller is in that activity\'s city.',
          items: {
            type: 'object',
            properties: {
              activityId: { type: 'string', description: 'Must be an id from the ACTIVITIES list, e.g. a17.' },
              dayIndex: { type: 'integer', description: '0-based day of the trip.' },
              startTime: { type: 'string', description: '24-hour HH:MM.' },
              note: { type: 'string', description: 'Optional short tip.' },
            },
            required: ['activityId', 'dayIndex'],
          },
        },
      },
      required: ['stops', 'items'],
    },
  },
}

export interface GeneratedItinerary extends Plan {
  tripName: string
  summary: string
  /** Resolved catalogue rows backing the plan, so callers can render names without re-querying. */
  cities: ShortlistCity[]
  activities: ShortlistActivity[]
}

function systemPrompt(): string {
  return [
    'You are a travel planner building an itinerary from a fixed catalogue.',
    '',
    'Hard rules:',
    '- Use ONLY cityId and activityId values that appear in the catalogue below. Never invent an id.',
    '- Schedule an activity only on a day when the traveller is in that activity\'s city.',
    '- Stops must be in travel order, must not overlap, and together must cover every day of the trip.',
    '- Prefer a small number of cities with real time in each over a rushed multi-city dash.',
    '- Vary activity types across a day; do not stack five museums together.',
    '',
    'Call the propose_itinerary function exactly once. Do not reply with prose.',
  ].join('\n')
}

function userPrompt(input: GenerateItineraryInput, cataloguePrompt: string): string {
  const perDay = ACTIVITIES_PER_DAY[input.pace]
  return [
    `Destination request: ${input.destination}`,
    `Trip length: ${input.days} days (day indices 0 to ${input.days - 1})`,
    `Pace: ${input.pace} — aim for about ${perDay} activities per day.`,
    input.interests.length > 0 ? `Traveller interests: ${input.interests.join(', ')}` : 'Traveller interests: open to anything.',
    input.budgetCap
      ? `Budget: about ${input.budgetCap} ${input.currency} total for activities. Favour good value.`
      : 'Budget: not specified.',
    '',
    cataloguePrompt,
  ].join('\n')
}

/**
 * One model call, then deterministic repair. The proposal is advisory —
 * `planItinerary` decides what is actually persistable.
 */
export async function generateItinerary(
  input: GenerateItineraryInput,
  shortlist: CatalogueShortlist
): Promise<GeneratedItinerary> {
  const catalogue = renderShortlist(shortlist)

  // Groq counts the prompt and the reserved max_tokens against one 8000-token
  // budget, so output headroom is bought by keeping the catalogue small. Low
  // reasoning effort keeps the model from spending that headroom thinking
  // instead of emitting the tool call.
  const completion = await withRetry(() =>
    groq().chat.completions.create(
      {
        model: MODELS.itinerary,
        temperature: 0.5,
        max_tokens: 4000,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: userPrompt(input, catalogue.prompt) },
        ],
        tools: [TOOL],
        tool_choice: { type: 'function', function: { name: 'propose_itinerary' } },
      },
      { timeout: TIMEOUT_MS.generate }
    )
  ).catch((error: unknown) => {
    // A refused or truncated tool call is recoverable: planItinerary can build a
    // sound trip from the catalogue alone. Only surface hard failures.
    const code = (error as { error?: { error?: { code?: string } } })?.error?.error?.code
    if (code === 'tool_use_failed') return null
    throw error
  })

  const call = completion?.choices[0]?.message?.tool_calls?.[0]
  const raw = call?.function?.arguments

  // A missing or unparseable tool call is not fatal: an empty proposal still
  // produces a valid trip through the fallback paths in planItinerary.
  let proposal: Proposal = { stops: [], items: [] }
  let tripName = ''
  let summary = ''

  if (raw) {
    try {
      const parsed = proposedItinerarySchema.safeParse(JSON.parse(raw))
      if (parsed.success) {
        // Map aliases back to real ids. Anything unmappable is left as-is so
        // planItinerary counts it as unverifiable rather than silently vanishing.
        proposal = {
          stops: parsed.data.stops.map((s) => ({
            ...s,
            cityId: catalogue.cityByAlias.get(s.cityId) ?? s.cityId,
          })),
          items: parsed.data.items.map((i) => ({
            ...i,
            activityId: catalogue.activityByAlias.get(i.activityId) ?? i.activityId,
          })),
        }
        tripName = parsed.data.tripName ?? ''
        summary = parsed.data.summary ?? ''
      }
    } catch {
      // Fall through to the empty proposal.
    }
  }

  // Widen the activity pool to everything in the cities the model actually
  // chose, so a three-day stop is not left half empty by the slim prompt
  // shortlist. Interest-matching activities keep their priority.
  const chosenCityIds = [...new Set(proposal.stops.map((s) => s.cityId))].filter((id) =>
    shortlist.cities.some((c) => c.id === id)
  )
  const widened = await fetchActivitiesForCities(
    chosenCityIds.length > 0 ? chosenCityIds : shortlist.cities.map((c) => c.id)
  )
  const preferred = new Set<string>(input.interests)
  const pool = (widened.length > 0 ? widened : shortlist.activities)
    .slice()
    .sort((a, b) => {
      const aPref = preferred.has(a.type) ? 1 : 0
      const bPref = preferred.has(b.type) ? 1 : 0
      if (aPref !== bPref) return bPref - aPref
      return b.rating - a.rating
    })

  const plan = planItinerary(proposal, shortlist.cities, pool, {
    days: input.days,
    perDay: ACTIVITIES_PER_DAY[input.pace],
    budgetCap: input.budgetCap,
  })

  const leadCity = shortlist.cities.find((c) => c.id === plan.stops[0]?.cityId)
  return {
    ...plan,
    tripName: tripName || `${input.days} days in ${leadCity?.name ?? input.destination}`,
    summary,
    cities: shortlist.cities,
    activities: pool,
  }
}
