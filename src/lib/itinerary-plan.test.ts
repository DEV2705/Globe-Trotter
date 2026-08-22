import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planItinerary, type Proposal, type ShortlistActivity, type ShortlistCity } from './itinerary-plan'

const cities: ShortlistCity[] = [
  { id: 'c-bkk', name: 'Bangkok', country: 'Thailand', costIndex: 38 },
  { id: 'c-han', name: 'Hanoi', country: 'Vietnam', costIndex: 32 },
  { id: 'c-bal', name: 'Bali', country: 'Indonesia', costIndex: 40 },
]

function makeActivities(): ShortlistActivity[] {
  const out: ShortlistActivity[] = []
  for (const city of cities) {
    for (let i = 0; i < 6; i++) {
      out.push({
        id: `${city.id}-a${i}`,
        cityId: city.id,
        name: `${city.name} activity ${i}`,
        type: 'SIGHTSEEING',
        avgCost: 1000 + i * 500,
        durationMin: 120,
        rating: 5 - i * 0.2,
      })
    }
  }
  return out
}

const activities = makeActivities()

/** Every guarantee the database depends on, asserted in one place. */
function assertInvariants(plan: ReturnType<typeof planItinerary>, days: number, perDay: number) {
  const cityIds = new Set(cities.map((c) => c.id))
  const activityIds = new Set(activities.map((a) => a.id))

  for (const stop of plan.stops) {
    assert.ok(cityIds.has(stop.cityId), `stop references unknown city ${stop.cityId}`)
    assert.ok(stop.startDayIndex <= stop.endDayIndex, 'stop range inverted')
  }

  // Contiguous cover of the whole trip, no gaps, no overlaps.
  const sorted = [...plan.stops].sort((a, b) => a.startDayIndex - b.startDayIndex)
  assert.equal(sorted[0].startDayIndex, 0, 'trip must start at day 0')
  assert.equal(sorted[sorted.length - 1].endDayIndex, days - 1, 'trip must end on the last day')
  for (let i = 1; i < sorted.length; i++) {
    assert.equal(sorted[i].startDayIndex, sorted[i - 1].endDayIndex + 1, 'stops must be contiguous')
  }

  const perDayCount = new Map<number, number>()
  for (const item of plan.items) {
    assert.ok(activityIds.has(item.activityId), `item references unknown activity ${item.activityId}`)

    const owning = plan.stops.find((s) => s.cityId === item.cityId)
    assert.ok(owning, 'item has no owning stop')
    // The calendar invariant.
    assert.ok(
      item.dayIndex >= owning.startDayIndex && item.dayIndex <= owning.endDayIndex,
      `item on day ${item.dayIndex} falls outside its stop range ${owning.startDayIndex}-${owning.endDayIndex}`
    )
    assert.ok(item.dayIndex >= 0 && item.dayIndex < days, 'day index out of trip range')
    perDayCount.set(item.dayIndex, (perDayCount.get(item.dayIndex) ?? 0) + 1)
  }

  for (const [, count] of perDayCount) {
    assert.ok(count <= perDay, 'a day exceeded the pace cap')
  }

  const seen = new Set<string>()
  for (const item of plan.items) {
    assert.ok(!seen.has(item.activityId), 'activity scheduled twice')
    seen.add(item.activityId)
  }
}

test('accepts a well-formed proposal unchanged', () => {
  const proposal: Proposal = {
    stops: [
      { cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 2, reason: 'Street food' },
      { cityId: 'c-han', startDayIndex: 3, endDayIndex: 5, reason: 'Old Quarter' },
    ],
    items: [
      { activityId: 'c-bkk-a0', dayIndex: 0 },
      { activityId: 'c-bkk-a1', dayIndex: 1 },
      { activityId: 'c-han-a0', dayIndex: 3 },
    ],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 6, perDay: 3 })
  assertInvariants(plan, 6, 3)
  assert.equal(plan.stops.length, 2)
})

test('rejects hallucinated city and activity ids', () => {
  const proposal: Proposal = {
    stops: [
      { cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 1 },
      { cityId: 'c-atlantis', startDayIndex: 2, endDayIndex: 3 },
    ],
    items: [
      { activityId: 'c-bkk-a0', dayIndex: 0 },
      { activityId: 'totally-made-up', dayIndex: 1 },
      { activityId: 'c-atlantis-a0', dayIndex: 2 },
    ],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 4, perDay: 3 })
  assertInvariants(plan, 4, 3)
  assert.ok(!plan.stops.some((s) => s.cityId === 'c-atlantis'))
  assert.ok(!plan.items.some((i) => i.activityId.includes('made-up')))
  assert.ok(plan.notices.some((n) => n.includes('could not verify')))
})

test('clamps an activity dropped outside its stop range', () => {
  const proposal: Proposal = {
    stops: [
      { cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 1 },
      { cityId: 'c-han', startDayIndex: 2, endDayIndex: 3 },
    ],
    // A Bangkok activity scheduled on a Hanoi day.
    items: [{ activityId: 'c-bkk-a0', dayIndex: 3 }],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 4, perDay: 3 })
  assertInvariants(plan, 4, 3)
  const moved = plan.items.find((i) => i.activityId === 'c-bkk-a0')
  assert.ok(moved && moved.dayIndex <= 1, 'should have been pulled back into the Bangkok stop')
})

test('repairs overlapping and out-of-range stop ranges', () => {
  const proposal: Proposal = {
    stops: [
      { cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 9 },
      { cityId: 'c-han', startDayIndex: 2, endDayIndex: 11 },
      { cityId: 'c-bal', startDayIndex: -4, endDayIndex: 1 },
    ],
    items: [],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 6, perDay: 2 })
  assertInvariants(plan, 6, 2)
})

test('falls back to a single-city trip when every stop is invalid', () => {
  const proposal: Proposal = {
    stops: [{ cityId: 'nope', startDayIndex: 0, endDayIndex: 3 }],
    items: [{ activityId: 'also-nope', dayIndex: 0 }],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 4, perDay: 2 })
  assertInvariants(plan, 4, 2)
  assert.equal(plan.stops.length, 1)
  assert.ok(plan.notices.some((n) => n.includes('single-city')))
})

test('leaves no empty day while candidates remain', () => {
  const proposal: Proposal = {
    stops: [{ cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 3 }],
    items: [{ activityId: 'c-bkk-a0', dayIndex: 0 }],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 4, perDay: 2 })
  assertInvariants(plan, 4, 2)
  for (let day = 0; day < 4; day++) {
    assert.ok(plan.items.some((i) => i.dayIndex === day), `day ${day} is empty`)
  }
})

test('honours the pace cap when the model overfills a day', () => {
  const proposal: Proposal = {
    stops: [{ cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 1 }],
    items: [0, 1, 2, 3, 4, 5].map((i) => ({ activityId: `c-bkk-a${i}`, dayIndex: 0 })),
  }
  const plan = planItinerary(proposal, cities, activities, { days: 2, perDay: 2 })
  assertInvariants(plan, 2, 2)
  assert.equal(plan.items.filter((i) => i.dayIndex === 0).length, 2)
})

test('trims to fit a budget cap without emptying a day', () => {
  const proposal: Proposal = {
    stops: [{ cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 2 }],
    items: [
      { activityId: 'c-bkk-a0', dayIndex: 0 },
      { activityId: 'c-bkk-a1', dayIndex: 0 },
      { activityId: 'c-bkk-a2', dayIndex: 1 },
      { activityId: 'c-bkk-a3', dayIndex: 1 },
      { activityId: 'c-bkk-a4', dayIndex: 2 },
      { activityId: 'c-bkk-a5', dayIndex: 2 },
    ],
  }
  // Unconstrained total is 13500. Keeping one activity per day costs at least
  // 1000 + 2000 + 3000 = 6000, so 7000 is reachable by trimming.
  const budgetCap = 7000
  const plan = planItinerary(proposal, cities, activities, { days: 3, perDay: 3, budgetCap })
  assertInvariants(plan, 3, 3)
  assert.ok(plan.total <= budgetCap, `total ${plan.total} should be within ${budgetCap}`)
  for (let day = 0; day < 3; day++) {
    assert.ok(plan.items.some((i) => i.dayIndex === day), `budget trimming emptied day ${day}`)
  }
})

test('reports honestly when the budget cannot be met', () => {
  const proposal: Proposal = {
    stops: [{ cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 2 }],
    items: [
      { activityId: 'c-bkk-a0', dayIndex: 0 },
      { activityId: 'c-bkk-a1', dayIndex: 0 },
      { activityId: 'c-bkk-a2', dayIndex: 1 },
      { activityId: 'c-bkk-a4', dayIndex: 2 },
    ],
  }
  // One activity per day already costs 6000; 3000 is impossible without an empty day.
  const plan = planItinerary(proposal, cities, activities, { days: 3, perDay: 3, budgetCap: 3000 })
  assertInvariants(plan, 3, 3)
  for (let day = 0; day < 3; day++) {
    assert.ok(plan.items.some((i) => i.dayIndex === day), `day ${day} was emptied to chase the budget`)
  }
  assert.ok(
    plan.notices.some((n) => n.includes('still above your budget')),
    'should say so rather than silently returning an over-budget trip'
  )
})

test('survives a completely empty proposal', () => {
  const plan = planItinerary({ stops: [], items: [] }, cities, activities, { days: 3, perDay: 2 })
  assertInvariants(plan, 3, 2)
  assert.ok(plan.items.length > 0, 'should still produce a usable trip')
})

test('single-day trip is valid', () => {
  const proposal: Proposal = {
    stops: [{ cityId: 'c-bkk', startDayIndex: 0, endDayIndex: 0 }],
    items: [{ activityId: 'c-bkk-a0', dayIndex: 0 }],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 1, perDay: 3 })
  assertInvariants(plan, 1, 3)
})

test('more cities than days does not produce zero-length stops', () => {
  const proposal: Proposal = {
    stops: cities.map((c, i) => ({ cityId: c.id, startDayIndex: i, endDayIndex: i })),
    items: [],
  }
  const plan = planItinerary(proposal, cities, activities, { days: 2, perDay: 2 })
  assertInvariants(plan, 2, 2)
  assert.ok(plan.stops.length <= 2)
})
