/**
 * Deterministic repair layer between a model proposal and the database.
 *
 * The model *chooses* cities and activities; this module decides what actually
 * gets written. It is pure — no Prisma, no Decimal, no Date, no network — so the
 * hallucination-handling can be unit-tested offline.
 *
 * Guarantees for any output of `planItinerary`, regardless of how malformed the
 * proposal was:
 *   1. Every cityId / activityId came from the shortlist we sent the model.
 *   2. Stops are contiguous, non-overlapping, and cover exactly [0, days-1].
 *   3. Every item's dayIndex lies inside its own stop's range — the invariant
 *      the calendar depends on.
 *   4. No day exceeds the pace cap; no day is left empty while candidates remain.
 *   5. If a budget cap is given and can be met, the total lands under it.
 */

export interface ShortlistCity {
  id: string
  name: string
  country: string
  costIndex: number
}

export interface ShortlistActivity {
  id: string
  cityId: string
  name: string
  type: string
  avgCost: number
  durationMin: number
  rating: number
}

export interface ProposalStop {
  cityId: string
  startDayIndex: number
  endDayIndex: number
  reason?: string
}

export interface ProposalItem {
  activityId: string
  dayIndex: number
  startTime?: string
  note?: string
}

export interface Proposal {
  stops: ProposalStop[]
  items: ProposalItem[]
}

export interface PlannedStop {
  cityId: string
  startDayIndex: number
  endDayIndex: number
  reason: string
}

export interface PlannedItem {
  activityId: string
  cityId: string
  dayIndex: number
  startTime: string
  order: number
  cost: number
  note?: string
}

export interface Plan {
  stops: PlannedStop[]
  items: PlannedItem[]
  total: number
  /** Populated when repair changed something — surfaced in the review UI. */
  notices: string[]
}

export interface PlanOptions {
  days: number
  perDay: number
  budgetCap?: number
}

/** Default slot times, in order, for activities within a day. */
const SLOT_TIMES = ['09:00', '11:30', '14:00', '16:30', '19:00', '21:00']

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * Force an arbitrary set of stops into a contiguous cover of [0, days-1].
 * Preserves the model's ordering and rough proportions; drops stops that get
 * squeezed to nothing.
 */
function normaliseStops(
  raw: ProposalStop[],
  cityById: Map<string, ShortlistCity>,
  days: number,
  notices: string[]
): PlannedStop[] {
  const seen = new Set<string>()
  const valid: ProposalStop[] = []

  for (const stop of raw) {
    if (!cityById.has(stop.cityId)) {
      notices.push('Skipped a suggested city that is not in our catalogue.')
      continue
    }
    if (seen.has(stop.cityId)) continue
    seen.add(stop.cityId)
    valid.push(stop)
  }

  if (valid.length === 0) return []

  valid.sort((a, b) => a.startDayIndex - b.startDayIndex)

  // Give every stop a share of the trip proportional to what was proposed,
  // then lay them end to end so there are no gaps or overlaps.
  const weights = valid.map((s) => Math.max(1, s.endDayIndex - s.startDayIndex + 1))
  const weightTotal = weights.reduce((sum, w) => sum + w, 0)

  const out: PlannedStop[] = []
  let cursor = 0

  valid.forEach((stop, i) => {
    const remainingStops = valid.length - i
    const remainingDays = days - cursor
    if (remainingDays < remainingStops) return // no room left for this stop

    const proportional = Math.round((weights[i] / weightTotal) * days)
    const maxForThisStop = remainingDays - (remainingStops - 1)
    const length = clamp(proportional || 1, 1, maxForThisStop)

    out.push({
      cityId: stop.cityId,
      startDayIndex: cursor,
      endDayIndex: cursor + length - 1,
      reason: stop.reason?.trim() ?? '',
    })
    cursor += length
  })

  if (out.length === 0) return []

  // Rounding can leave a tail; hand it to the final stop.
  out[out.length - 1].endDayIndex = days - 1
  if (out.length < valid.length) {
    notices.push('Trimmed the city list to fit the number of days.')
  }
  return out
}

function stopForDay(stops: PlannedStop[], dayIndex: number): PlannedStop | undefined {
  return stops.find((s) => dayIndex >= s.startDayIndex && dayIndex <= s.endDayIndex)
}

/** Cheapest-per-unit-of-quality first — the first thing to cut when over budget. */
function valueScore(activity: ShortlistActivity): number {
  return activity.avgCost / Math.max(1, activity.rating)
}

export function planItinerary(
  proposal: Proposal,
  cities: ShortlistCity[],
  activities: ShortlistActivity[],
  options: PlanOptions
): Plan {
  const notices: string[] = []
  const days = Math.max(1, options.days)
  const perDay = clamp(options.perDay, 1, SLOT_TIMES.length)

  const cityById = new Map(cities.map((c) => [c.id, c]))
  const activityById = new Map(activities.map((a) => [a.id, a]))

  let stops = normaliseStops(proposal.stops ?? [], cityById, days, notices)

  // Nothing usable came back — fall back to the strongest catalogue city so the
  // user still gets a trip rather than an error.
  if (stops.length === 0) {
    const fallback = cities[0]
    if (!fallback) return { stops: [], items: [], total: 0, notices: ['No matching destinations found.'] }
    notices.push('Could not use the suggested route, so we built a single-city trip instead.')
    stops = [{ cityId: fallback.id, startDayIndex: 0, endDayIndex: days - 1, reason: '' }]
  }

  // --- Items -------------------------------------------------------------
  const byDay = new Map<number, PlannedItem[]>()
  const used = new Set<string>()
  let hallucinated = 0

  for (const item of proposal.items ?? []) {
    const activity = activityById.get(item.activityId)
    if (!activity) {
      hallucinated++
      continue
    }
    if (used.has(activity.id)) continue

    // The day the model asked for, clamped into the stop that owns this city.
    const owning = stops.find((s) => s.cityId === activity.cityId)
    if (!owning) continue

    const dayIndex = clamp(item.dayIndex, owning.startDayIndex, owning.endDayIndex)
    const slot = byDay.get(dayIndex) ?? []
    if (slot.length >= perDay) continue

    used.add(activity.id)
    slot.push({
      activityId: activity.id,
      cityId: activity.cityId,
      dayIndex,
      startTime: item.startTime ?? SLOT_TIMES[slot.length],
      order: slot.length,
      cost: activity.avgCost,
      note: item.note,
    })
    byDay.set(dayIndex, slot)
  }

  if (hallucinated > 0) {
    notices.push(`Ignored ${hallucinated} suggested ${hallucinated === 1 ? 'activity' : 'activities'} we could not verify.`)
  }

  // --- Fill empty days ---------------------------------------------------
  const byCity = new Map<string, ShortlistActivity[]>()
  for (const activity of activities) {
    const list = byCity.get(activity.cityId) ?? []
    list.push(activity)
    byCity.set(activity.cityId, list)
  }
  for (const list of byCity.values()) list.sort((a, b) => b.rating - a.rating)

  const takeCandidate = (cityId: string): ShortlistActivity | undefined => {
    const candidate = byCity.get(cityId)?.find((a) => !used.has(a.id))
    if (candidate) used.add(candidate.id)
    return candidate
  }

  const pushInto = (day: number, activity: ShortlistActivity) => {
    const slot = byDay.get(day) ?? []
    slot.push({
      activityId: activity.id,
      cityId: activity.cityId,
      dayIndex: day,
      startTime: SLOT_TIMES[slot.length],
      order: slot.length,
      cost: activity.avgCost,
      note: undefined,
    })
    byDay.set(day, slot)
  }

  // Two passes, and the order matters. Breadth first: every day gets one
  // activity before any day gets a second, otherwise a greedy top-up spends the
  // whole city's supply on the early days and leaves the last day empty.
  for (let day = 0; day < days; day++) {
    const stop = stopForDay(stops, day)
    if (!stop || (byDay.get(day)?.length ?? 0) > 0) continue
    const candidate = takeCandidate(stop.cityId)
    if (candidate) pushInto(day, candidate)
  }

  // Depth second: top days up toward the requested pace with whatever is left.
  for (let day = 0; day < days; day++) {
    const stop = stopForDay(stops, day)
    if (!stop) continue
    while ((byDay.get(day)?.length ?? 0) < perDay) {
      const candidate = takeCandidate(stop.cityId)
      if (!candidate) break
      pushInto(day, candidate)
    }
  }

  let items = [...byDay.values()].flat()

  // A city with fewer catalogue activities than it has days genuinely runs out.
  // That is legitimate free time, but say so rather than letting it read as a bug.
  const emptyDays = Array.from({ length: days }, (_, d) => d).filter(
    (d) => (byDay.get(d)?.length ?? 0) === 0
  )
  if (emptyDays.length > 0) {
    notices.push(
      `${emptyDays.length === 1 ? 'Day' : 'Days'} ${emptyDays.map((d) => d + 1).join(', ')} left free — we ran out of listed activities there. Add your own any time.`
    )
  }

  // --- Budget fitting ----------------------------------------------------
  // Arithmetic stays here, not in the prompt. Trim worst-value items first,
  // never emptying a day that still has only one activity.
  let total = items.reduce((sum, i) => sum + i.cost, 0)

  if (options.budgetCap && total > options.budgetCap) {
    const dayCounts = new Map<number, number>()
    for (const item of items) dayCounts.set(item.dayIndex, (dayCounts.get(item.dayIndex) ?? 0) + 1)

    const droppable = items
      .filter((i) => (dayCounts.get(i.dayIndex) ?? 0) > 1)
      .sort((a, b) => {
        const av = activityById.get(a.activityId)
        const bv = activityById.get(b.activityId)
        return (bv ? valueScore(bv) : 0) - (av ? valueScore(av) : 0)
      })

    const dropped = new Set<string>()
    for (const item of droppable) {
      if (total <= options.budgetCap) break
      if ((dayCounts.get(item.dayIndex) ?? 0) <= 1) continue
      dropped.add(item.activityId)
      dayCounts.set(item.dayIndex, (dayCounts.get(item.dayIndex) ?? 0) - 1)
      total -= item.cost
    }

    if (dropped.size > 0) {
      items = items.filter((i) => !dropped.has(i.activityId))
      notices.push(`Removed ${dropped.size} ${dropped.size === 1 ? 'activity' : 'activities'} to fit your budget.`)
    }
    if (total > options.budgetCap) {
      notices.push('This itinerary is still above your budget — the essentials alone exceed it.')
    }
  }

  // Renumber order and reassign slot times per day after all mutations.
  const finalByDay = new Map<number, PlannedItem[]>()
  for (const item of items) {
    const list = finalByDay.get(item.dayIndex) ?? []
    list.push(item)
    finalByDay.set(item.dayIndex, list)
  }
  const normalised: PlannedItem[] = []
  for (const [, list] of [...finalByDay.entries()].sort((a, b) => a[0] - b[0])) {
    // The model supplies its own times and does not always give them in order;
    // a day that reads 09:00, 18:00, 14:00 looks broken even though it is valid.
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    list.forEach((item, index) => {
      normalised.push({ ...item, order: index, startTime: item.startTime ?? SLOT_TIMES[index] })
    })
  }

  return {
    stops,
    items: normalised,
    total: normalised.reduce((sum, i) => sum + i.cost, 0),
    notices,
  }
}
