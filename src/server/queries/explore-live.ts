import { db } from '@/server/db'
import { getCitiesLiveInfo, type CityLiveInfo, type CityLiveInput } from '@/server/queries/live-city-info'

/**
 * Everything the Explore grid shows beyond the raw catalogue row: live conditions, an
 * estimated nightly rate, a flight estimate from the traveller's hub, travel vibes derived
 * from what a city actually offers, and the season/deal badges that follow from all of it.
 *
 * The estimates are explicitly *estimates* — modelled from the catalogue's cost index, not
 * quoted from an inventory provider. The UI labels them "from" and "est." for that reason.
 */

/** Departure hub the flight estimates are measured from. */
const HOME_HUB = { name: 'Delhi', lat: 28.5562, lng: 77.1 }
const CRUISE_KMH = 820
/** Taxi, climb and descent that no cruise-speed calculation captures. */
const GROUND_OVERHEAD_MIN = 45
const DIRECT_RANGE_KM = 6500

/** INR per cost-index point, per night, for the cheapest respectable room. */
const STAY_PER_POINT = 55
const STAY_ROUNDING = 100

/** Daily spend split — the shares the drawer's breakdown renders. */
export const BUDGET_SHARES = { stay: 0.45, food: 0.25, activities: 0.2, transport: 0.1 } as const

export type VibeKey = 'beach' | 'culture' | 'food' | 'nature' | 'shopping'

export interface Vibe {
  key: VibeKey
  label: string
  emoji: string
}

export const VIBES: Vibe[] = [
  { key: 'beach', label: 'Beaches & Islands', emoji: '🏖️' },
  { key: 'culture', label: 'History & Culture', emoji: '🏛️' },
  { key: 'food', label: 'Food & Street Markets', emoji: '🍜' },
  { key: 'nature', label: 'Nature & Adventure', emoji: '🏔️' },
  { key: 'shopping', label: 'Shopping & Nightlife', emoji: '🛍️' },
]

export const VIBE_BY_KEY: Record<VibeKey, Vibe> = Object.fromEntries(
  VIBES.map((v) => [v.key, v])
) as Record<VibeKey, Vibe>

export type DealTone = 'hot' | 'good' | 'info'

export interface Deal {
  key: 'off-season' | 'top-rated' | 'best-value' | 'best-season'
  label: string
  emoji: string
  tone: DealTone
}

export interface FlightEstimate {
  hub: string
  minutes: number
  label: string
  direct: boolean
  distanceKm: number
}

export interface SeasonEstimate {
  /** "Nov – Feb" */
  window: string
  months: number[]
  inSeason: boolean
}

export interface BudgetBreakdown {
  stay: number
  food: number
  activities: number
  transport: number
  total: number
}

export interface ExploreCityInsights {
  cityId: string
  live: CityLiveInfo
  stayFromPerNight: number
  dailyBudget: BudgetBreakdown
  flight: FlightEstimate | null
  vibes: VibeKey[]
  season: SeasonEstimate
  deals: Deal[]
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

function stayFromPerNight(costIndex: number): number {
  return Math.max(STAY_ROUNDING, Math.round((costIndex * STAY_PER_POINT) / STAY_ROUNDING) * STAY_ROUNDING)
}

function dailyBudgetFrom(stay: number): BudgetBreakdown {
  const total = Math.round(stay / BUDGET_SHARES.stay)
  return {
    stay,
    food: Math.round(total * BUDGET_SHARES.food),
    activities: Math.round(total * BUDGET_SHARES.activities),
    transport: Math.round(total * BUDGET_SHARES.transport),
    total,
  }
}

const EARTH_RADIUS_KM = 6371

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function formatFlight(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function flightEstimate(lat: number | null, lng: number | null): FlightEstimate | null {
  if (lat === null || lng === null) return null
  const distanceKm = Math.round(haversineKm(HOME_HUB, { lat, lng }))
  if (distanceKm < 150) return null // same metro — a flight estimate would be nonsense
  const minutes = Math.round((distanceKm / CRUISE_KMH) * 60 + GROUND_OVERHEAD_MIN)
  const direct = distanceKm <= DIRECT_RANGE_KM
  return {
    hub: HOME_HUB.name,
    minutes,
    distanceKm,
    direct,
    label: `~${formatFlight(minutes)} ${direct ? 'direct' : 'with a stop'} from ${HOME_HUB.name}`,
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "Nov – Feb", or "Apr – Jun, Sep – Oct" when the peak splits into shoulder seasons. Printing
 * first–last would otherwise claim the excluded midsummer months are peak too.
 */
function monthWindow(months: number[]): string {
  if (months.length === 0) return 'Year-round'
  if (months.length >= 12) return 'Year-round'

  const set = new Set(months)
  // A run starts at a month whose predecessor is absent — wrapping December to January.
  const starts = months.filter((m) => !set.has((m + 11) % 12))

  return starts
    .map((start) => {
      let end = start
      while (set.has((end + 1) % 12)) end = (end + 1) % 12
      return start === end ? MONTH_NAMES[start] : `${MONTH_NAMES[start]} – ${MONTH_NAMES[end]}`
    })
    .join(', ')
}

/**
 * Dry/shoulder season by latitude band — tropical destinations peak in their dry months,
 * temperate ones in spring and autumn, and the southern hemisphere runs opposite.
 */
function seasonEstimate(lat: number | null, now: Date): SeasonEstimate {
  const month = now.getUTCMonth()
  let months: number[]

  if (lat === null) months = []
  else if (Math.abs(lat) <= 23.5) months = lat >= 0 ? [10, 11, 0, 1] : [4, 5, 6, 7, 8]
  else if (lat > 23.5) months = [3, 4, 5, 8, 9]
  else months = [9, 10, 11, 0, 1, 2]

  return {
    window: months.length ? monthWindow(months) : 'Year-round',
    months,
    inSeason: months.length === 0 || months.includes(month),
  }
}

/** Off-season discount, in whole percent — deeper the further a city sits from its peak. */
function offSeasonDiscount(costIndex: number): number {
  return costIndex < 45 ? 30 : costIndex > 75 ? 20 : 25
}

function buildDeals(
  city: { costIndex: number; popularity: number },
  season: SeasonEstimate
): Deal[] {
  const deals: Deal[] = []

  if (!season.inSeason) {
    deals.push({
      key: 'off-season',
      label: `${offSeasonDiscount(city.costIndex)}% off season deal`,
      emoji: '🔥',
      tone: 'hot',
    })
  }
  if (city.popularity > 90) {
    deals.push({ key: 'top-rated', label: 'Top rated destination', emoji: '🌟', tone: 'good' })
  }
  if (city.costIndex < 45) {
    deals.push({ key: 'best-value', label: 'Best value for money', emoji: '💡', tone: 'good' })
  }
  deals.push({
    key: 'best-season',
    label: `Best time to visit: ${season.window}`,
    emoji: '🏖️',
    tone: 'info',
  })

  return deals
}

// ---------------------------------------------------------------------------
// Vibes — derived from what a city actually offers, not a hand-kept city list
// ---------------------------------------------------------------------------

// Deliberately narrow: "boat", "cruise" and "coast" match river tours and lake trips in
// landlocked cities, which is how Bangkok and Queenstown ended up reading as beach towns.
const BEACH_WORDS = /beach|island|snorkel|scuba|diving|reef|lagoon|surf/i

const TYPE_VIBES: Record<string, VibeKey> = {
  CULTURE: 'culture',
  SIGHTSEEING: 'culture',
  FOOD: 'food',
  NATURE: 'nature',
  ADVENTURE: 'nature',
  SHOPPING: 'shopping',
  NIGHTLIFE: 'shopping',
  // RELAX is deliberately unmapped — a spa day is not a beach.
}

/**
 * Catalogue cities carry roughly one activity per category, so a single supporting activity
 * is the honest signal: the question a vibe filter answers is "does this city offer this at
 * all", not "is it dominated by it".
 */
const VIBE_MIN_ACTIVITIES = 1

function deriveVibes(rows: { type: string; name: string; description: string }[]): VibeKey[] {
  if (rows.length === 0) return []
  const scores = new Map<VibeKey, number>()
  const bump = (key: VibeKey, by = 1) => scores.set(key, (scores.get(key) ?? 0) + by)

  for (const row of rows) {
    const vibe = TYPE_VIBES[row.type]
    if (vibe) bump(vibe)
    // Name only: prose descriptions mention islands and reefs in passing, which was enough
    // to read Bangkok as a beach destination.
    if (BEACH_WORDS.test(row.name)) bump('beach')
  }

  return VIBES.map((v) => v.key).filter((key) => (scores.get(key) ?? 0) >= VIBE_MIN_ACTIVITIES)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExploreCityInput extends CityLiveInput {
  id: string
}

export async function getExploreCityInsights(
  city: ExploreCityInput,
  homeCurrency = 'INR'
): Promise<ExploreCityInsights> {
  const [insights] = await getExploreCitiesInsights([city], homeCurrency)
  return insights
}

/**
 * One live-data round trip and one catalogue query for the whole grid. Settled independently
 * so a provider outage costs the weather pill, not the page.
 */
export async function getExploreCitiesInsights(
  cities: ExploreCityInput[],
  homeCurrency = 'INR'
): Promise<ExploreCityInsights[]> {
  const ids = cities.map((c) => c.id)

  const [liveResult, activityResult] = await Promise.allSettled([
    getCitiesLiveInfo(cities, homeCurrency),
    db.activity.findMany({
      where: { cityId: { in: ids } },
      select: { cityId: true, type: true, name: true, description: true },
    }),
  ])

  const live = liveResult.status === 'fulfilled' ? liveResult.value : []
  const activities = activityResult.status === 'fulfilled' ? activityResult.value : []

  const byCity = new Map<string, { type: string; name: string; description: string }[]>()
  for (const row of activities) {
    const list = byCity.get(row.cityId) ?? []
    list.push(row)
    byCity.set(row.cityId, list)
  }

  // One clock for the whole grid, so two cards can never straddle a month boundary.
  const now = new Date()

  return cities.map((city, i) => {
    const stay = stayFromPerNight(city.costIndex)
    const season = seasonEstimate(city.lat, now)

    return {
      cityId: city.id,
      live:
        live[i] ??
        ({
          weather: null,
          timezone: null,
          currency: null,
          verdicts: {
            weather: null,
            cost: { label: 'Mid-range', emoji: '⚖️', tone: 'info' },
            popularity: { label: 'Hidden gem', emoji: '🧭', tone: 'info' },
          },
          tips: [],
        } satisfies CityLiveInfo),
      stayFromPerNight: stay,
      dailyBudget: dailyBudgetFrom(stay),
      flight: flightEstimate(city.lat, city.lng),
      vibes: deriveVibes(byCity.get(city.id) ?? []),
      season,
      deals: buildDeals(city, season),
    }
  })
}
