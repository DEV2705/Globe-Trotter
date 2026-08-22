import 'server-only'
import { db } from '@/server/db'
import { tripLength, formatDay } from '@/lib/dates'
import type { ShortlistActivity, ShortlistCity } from '@/lib/itinerary-plan'

/**
 * Grounding context, assembled from the database.
 *
 * The caller always supplies the userId from `requireUser()`. No function here
 * lets a model choose whose rows get read — that decision is never delegated.
 */

// Sized against Groq's 8000 token-per-minute free tier, which counts the prompt
// AND the reserved max_tokens toward one request. A larger catalogue leaves too
// little output budget and the model truncates before emitting its tool call.
const MAX_CITIES = 8
const MAX_ACTIVITIES_PER_CITY = 5

export interface CatalogueShortlist {
  cities: ShortlistCity[]
  activities: ShortlistActivity[]
}

/**
 * Narrow the 60-city / 328-activity catalogue to something promptable.
 * Sending everything would be slow, expensive, and would bury the relevant rows.
 */
export async function buildCatalogueShortlist(
  destination: string,
  interests: string[]
): Promise<CatalogueShortlist> {
  const terms = destination
    .split(/[,/&]|\band\b/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 4)

  const where =
    terms.length > 0
      ? {
          OR: terms.flatMap((term) => [
            { name: { contains: term, mode: 'insensitive' as const } },
            { country: { contains: term, mode: 'insensitive' as const } },
            { region: { contains: term, mode: 'insensitive' as const } },
          ]),
        }
      : {}

  let cityRows = await db.city.findMany({
    where,
    select: { id: true, name: true, country: true, region: true, costIndex: true, popularity: true },
    orderBy: { popularity: 'desc' },
    take: MAX_CITIES,
  })

  // Free-text that matches nothing still deserves a trip — fall back to the
  // most popular destinations rather than returning an error.
  if (cityRows.length === 0) {
    cityRows = await db.city.findMany({
      select: { id: true, name: true, country: true, region: true, costIndex: true, popularity: true },
      orderBy: { popularity: 'desc' },
      take: MAX_CITIES,
    })
  }

  const cityIds = cityRows.map((c) => c.id)
  const activityRows = await db.activity.findMany({
    where: { cityId: { in: cityIds } },
    select: {
      id: true,
      cityId: true,
      name: true,
      type: true,
      avgCost: true,
      durationMin: true,
      rating: true,
    },
    orderBy: { rating: 'desc' },
  })

  // Interests rank the shortlist, they do not restrict it. Filtering hard here
  // starves multi-city trips: a 4-city, 8-day trip at 3 activities/day needs ~24
  // candidates, and three interest tags rarely yield that across the catalogue.
  // Preferred types come first, then the best of the rest tops each city up.
  const preferred = new Set(interests)
  const ranked = [...activityRows].sort((a, b) => {
    const aPref = preferred.has(a.type) ? 1 : 0
    const bPref = preferred.has(b.type) ? 1 : 0
    if (aPref !== bPref) return bPref - aPref
    return b.rating - a.rating
  })

  // Cap per city so one dense city cannot crowd out the rest of the route.
  const perCity = new Map<string, ShortlistActivity[]>()
  for (const row of ranked) {
    const list = perCity.get(row.cityId) ?? []
    if (list.length >= MAX_ACTIVITIES_PER_CITY) continue
    list.push({
      id: row.id,
      cityId: row.cityId,
      name: row.name,
      type: row.type,
      avgCost: Number(row.avgCost),
      durationMin: row.durationMin,
      rating: row.rating,
    })
    perCity.set(row.cityId, list)
  }

  return {
    cities: cityRows.map((c) => ({
      id: c.id,
      name: c.name,
      country: c.country,
      costIndex: c.costIndex,
    })),
    activities: [...perCity.values()].flat(),
  }
}

/**
 * Every activity in the chosen cities, unfiltered.
 *
 * The prompt-facing shortlist is deliberately small to fit the token budget, but
 * that leaves too few candidates to fill a multi-day stop. Once the model has
 * committed to a route we can widen the pool for free — this is a database read,
 * not a prompt, so it costs no tokens and every id is real by construction.
 */
export async function fetchActivitiesForCities(cityIds: string[]): Promise<ShortlistActivity[]> {
  if (cityIds.length === 0) return []
  const rows = await db.activity.findMany({
    where: { cityId: { in: cityIds } },
    select: {
      id: true,
      cityId: true,
      name: true,
      type: true,
      avgCost: true,
      durationMin: true,
      rating: true,
    },
    orderBy: { rating: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    cityId: r.cityId,
    name: r.name,
    type: r.type,
    avgCost: Number(r.avgCost),
    durationMin: r.durationMin,
    rating: r.rating,
  }))
}

export interface AliasedShortlist {
  prompt: string
  /** Alias ("c3", "a17") back to the real cuid. */
  cityByAlias: Map<string, string>
  activityByAlias: Map<string, string>
}

/**
 * Render the catalogue using short aliases rather than cuids.
 *
 * A 25-character cuid repeated twice per activity row dominates the prompt, and
 * Groq's free tier caps a request at 8000 tokens including `max_tokens`. Aliases
 * cut the catalogue to roughly a third of the size, and an alias the model
 * invents is trivially unmappable rather than a plausible-looking id.
 */
export function renderShortlist(shortlist: CatalogueShortlist): AliasedShortlist {
  const cityByAlias = new Map<string, string>()
  const activityByAlias = new Map<string, string>()
  const aliasByCity = new Map<string, string>()

  const lines: string[] = ['CITIES (id | name, country | cost 1-100):']
  shortlist.cities.forEach((c, i) => {
    const alias = `c${i + 1}`
    cityByAlias.set(alias, c.id)
    aliasByCity.set(c.id, alias)
    lines.push(`${alias} | ${c.name}, ${c.country} | ${c.costIndex}`)
  })

  lines.push('', 'ACTIVITIES (id | city | name | type | cost | mins):')
  shortlist.activities.forEach((a, i) => {
    const alias = `a${i + 1}`
    activityByAlias.set(alias, a.id)
    lines.push(
      `${alias} | ${aliasByCity.get(a.cityId) ?? '?'} | ${a.name} | ${a.type} | ${a.avgCost} | ${a.durationMin}`
    )
  })

  return { prompt: lines.join('\n'), cityByAlias, activityByAlias }
}

/**
 * Everything the assistant may know, scoped to one user.
 * Budget figures are computed here so the model never has to add anything up.
 */
export async function buildUserTripContext(userId: string, tripId?: string): Promise<string> {
  const trips = await db.trip.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      currency: true,
      budgetCap: true,
      stops: {
        orderBy: { order: 'asc' },
        select: {
          city: { select: { name: true, country: true } },
          items: { select: { cost: true, activity: { select: { name: true, type: true } } } },
        },
      },
      expenses: { select: { amount: true, category: true } },
    },
    orderBy: { startDate: 'asc' },
    take: 20,
  })

  if (trips.length === 0) return 'This user has not created any trips yet.'

  const lines: string[] = []
  for (const trip of trips) {
    const activityTotal = trip.stops.reduce(
      (sum, stop) => sum + stop.items.reduce((s, i) => s + Number(i.cost), 0),
      0
    )
    const expenseTotal = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const spent = activityTotal + expenseTotal
    const cap = trip.budgetCap ? Number(trip.budgetCap) : null

    const isFocus = tripId && trip.id === tripId
    lines.push(
      `${isFocus ? '>> CURRENTLY VIEWING: ' : ''}"${trip.name}" (id ${trip.id})`,
      `  Dates: ${formatDay(trip.startDate)} to ${formatDay(trip.endDate)} (${tripLength(trip.startDate, trip.endDate)} days)`,
      `  Cities: ${trip.stops.map((s) => `${s.city.name}, ${s.city.country}`).join(' -> ') || 'none yet'}`,
      `  Planned spend: ${spent.toFixed(0)} ${trip.currency}${cap !== null ? ` of a ${cap.toFixed(0)} ${trip.currency} budget (${cap - spent >= 0 ? `${(cap - spent).toFixed(0)} remaining` : `${(spent - cap).toFixed(0)} OVER`})` : ' (no budget cap set)'}`
    )

    if (isFocus) {
      const named = trip.stops.flatMap((s) => s.items.map((i) => i.activity.name)).slice(0, 25)
      if (named.length > 0) lines.push(`  Planned activities: ${named.join('; ')}`)
    }
  }

  return lines.join('\n')
}

/** Suggestions the assistant can draw on for "what should I see in X" questions. */
export async function buildSuggestionContext(userId: string): Promise<string> {
  const stops = await db.stop.findMany({
    where: { trip: { userId } },
    select: { cityId: true },
    take: 40,
  })
  const cityIds = [...new Set(stops.map((s) => s.cityId))]
  if (cityIds.length === 0) return ''

  const activities = await db.activity.findMany({
    where: { cityId: { in: cityIds } },
    select: { name: true, type: true, avgCost: true, city: { select: { name: true } } },
    orderBy: { rating: 'desc' },
    take: 60,
  })
  if (activities.length === 0) return ''

  const byCity = new Map<string, string[]>()
  for (const a of activities) {
    const list = byCity.get(a.city.name) ?? []
    if (list.length >= 8) continue
    list.push(`${a.name} (${a.type.toLowerCase()}, ~${Number(a.avgCost).toFixed(0)})`)
    byCity.set(a.city.name, list)
  }

  return [...byCity.entries()].map(([city, items]) => `${city}: ${items.join('; ')}`).join('\n')
}
