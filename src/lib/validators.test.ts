import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type ZodTypeAny } from 'zod'
import {
  loginSchema,
  registerSchema,
  profileSchema,
  tripSchema,
  stopSchema,
  stopUpdateSchema,
  reorderSchema,
  addActivitySchema,
  updateTripActivitySchema,
  reorderActivitiesSchema,
  expenseSchema,
  postSchema,
  citySearchSchema,
  activitySearchSchema,
  tripListSchema,
  communitySearchSchema,
  adminSearchSchema,
} from './validators.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Assert a Zod parse succeeds and return the parsed (output) value. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ok(schema: ZodTypeAny, input: unknown): any {
  const r = schema.safeParse(input)
  assert.equal(r.success, true, `Expected success but got failure for: ${JSON.stringify(input)}`)
  return r.data
}

/** Assert a Zod parse fails; optionally check the error message contains a substring. */
function fail(schema: ZodTypeAny, input: unknown, expectedMessage?: string) {
  const r = schema.safeParse(input)
  assert.equal(r.success, false, `Expected failure but got success for: ${JSON.stringify(input)}`)
  if (expectedMessage) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: string[] = (r as any).error?.errors?.map((e: { message: string }) => e.message) ?? []
    const matched = messages.some((m) => m.toLowerCase().includes(expectedMessage.toLowerCase()))
    assert.ok(matched, `Expected error containing "${expectedMessage}" but got: [${messages.join(', ')}]`)
  }
}

// ─── loginSchema ──────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    ok(loginSchema, { email: 'user@example.com', password: 'secret123' })
  })
  it('lowercases and trims email', () => {
    const d = ok(loginSchema, { email: '  USER@EXAMPLE.COM  ', password: 'x' })
    assert.equal(d.email, 'user@example.com')
  })
  it('rejects empty email', () => {
    fail(loginSchema, { email: '', password: 'secret123' }, 'valid email')
  })
  it('rejects invalid email format', () => {
    fail(loginSchema, { email: 'notanemail', password: 'secret123' }, 'valid email')
  })
  it('rejects email with no TLD', () => {
    fail(loginSchema, { email: 'user@example', password: 'secret123' }, 'valid email')
  })
  it('rejects missing password', () => {
    fail(loginSchema, { email: 'user@example.com', password: '' }, 'required')
  })
})

// ─── registerSchema ───────────────────────────────────────────────────────────

describe('registerSchema', () => {
  const base = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  }

  it('accepts a full valid registration', () => {
    ok(registerSchema, { ...base, phone: '+91 99999 00000', city: 'Mumbai', country: 'India', bio: 'Traveller', photoUrl: 'https://example.com/p.jpg' })
  })
  it('accepts minimal registration (optional fields absent)', () => {
    ok(registerSchema, base)
  })
  it('rejects empty firstName', () => {
    fail(registerSchema, { ...base, firstName: '' }, 'first name is required')
  })
  it('rejects whitespace-only firstName', () => {
    fail(registerSchema, { ...base, firstName: '   ' }, 'first name is required')
  })
  it('rejects empty lastName', () => {
    fail(registerSchema, { ...base, lastName: '' }, 'last name is required')
  })
  it('rejects invalid email', () => {
    fail(registerSchema, { ...base, email: 'bad-email' }, 'valid email')
  })
  it('rejects password shorter than 8 chars', () => {
    fail(registerSchema, { ...base, password: 'abc1234', confirmPassword: 'abc1234' }, '8 characters')
  })
  it('rejects password longer than 72 chars', () => {
    fail(registerSchema, { ...base, password: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) }, '72 characters')
  })
  it('rejects mismatched passwords', () => {
    fail(registerSchema, { ...base, password: 'password123', confirmPassword: 'different!' }, 'do not match')
  })
  it('treats empty bio as undefined', () => {
    const d = ok(registerSchema, { ...base, bio: '' })
    assert.equal(d.bio, undefined)
  })
  it('rejects bio longer than 500 chars', () => {
    fail(registerSchema, { ...base, bio: 'x'.repeat(501) })
  })
})

// ─── profileSchema ────────────────────────────────────────────────────────────

describe('profileSchema', () => {
  const base = { firstName: 'Jane', lastName: 'Doe', language: 'en' }

  it('accepts a valid profile', () => {
    ok(profileSchema, { ...base, phone: '123', city: 'Delhi', country: 'India', bio: 'Hello', photoUrl: 'https://img.com/a.png' })
  })
  it('accepts minimal profile', () => {
    ok(profileSchema, base)
  })
  it('rejects empty firstName', () => {
    fail(profileSchema, { ...base, firstName: '' }, 'first name is required')
  })
  it('rejects empty lastName', () => {
    fail(profileSchema, { ...base, lastName: '' }, 'last name is required')
  })
  it('rejects bio over 500 chars', () => {
    fail(profileSchema, { ...base, bio: 'x'.repeat(501) })
  })
  it('rejects language shorter than 2 chars', () => {
    fail(profileSchema, { ...base, language: 'x' })
  })
  it('rejects language longer than 10 chars', () => {
    fail(profileSchema, { ...base, language: 'x'.repeat(11) })
  })
  it('treats empty optional fields as undefined', () => {
    const d = ok(profileSchema, { ...base, phone: '', city: '', bio: '' })
    assert.equal(d.phone, undefined)
    assert.equal(d.city, undefined)
    assert.equal(d.bio, undefined)
  })
})

// ─── tripSchema ───────────────────────────────────────────────────────────────

describe('tripSchema', () => {
  const base = { name: 'My Trip', startDate: '2025-01-01', endDate: '2025-01-10' }

  it('accepts a valid trip', () => {
    ok(tripSchema, { ...base, budgetCap: 5000, currency: 'INR', description: 'Great trip!' })
  })
  it('accepts minimal trip (optional fields absent)', () => {
    ok(tripSchema, base)
  })
  it('rejects empty trip name', () => {
    fail(tripSchema, { ...base, name: '' }, 'trip name is required')
  })
  it('rejects whitespace-only name', () => {
    fail(tripSchema, { ...base, name: '   ' }, 'trip name is required')
  })
  it('rejects name longer than 120 chars', () => {
    fail(tripSchema, { ...base, name: 'x'.repeat(121) })
  })
  it('rejects description longer than 2000 chars', () => {
    fail(tripSchema, { ...base, description: 'x'.repeat(2001) })
  })
  it('rejects endDate before startDate', () => {
    fail(tripSchema, { ...base, startDate: '2025-01-10', endDate: '2025-01-01' }, 'on or after the start date')
  })
  it('accepts endDate equal to startDate (single-day trip)', () => {
    ok(tripSchema, { ...base, startDate: '2025-06-01', endDate: '2025-06-01' })
  })
  it('rejects trips longer than 365 days', () => {
    fail(tripSchema, { ...base, startDate: '2025-01-01', endDate: '2026-02-01' }, 'capped at 365')
  })
  it('accepts exactly 365-day trip', () => {
    ok(tripSchema, { ...base, startDate: '2025-01-01', endDate: '2025-12-31' })
  })
  it('rejects budgetCap of 0', () => {
    fail(tripSchema, { ...base, budgetCap: 0 }, 'greater than 0')
  })
  it('rejects negative budgetCap', () => {
    fail(tripSchema, { ...base, budgetCap: -100 }, 'greater than 0')
  })
  it('accepts empty string budgetCap (treated as undefined)', () => {
    const d = ok(tripSchema, { ...base, budgetCap: '' })
    assert.equal(d.budgetCap, undefined)
  })
  it('rejects invalid date format for startDate', () => {
    fail(tripSchema, { ...base, startDate: '01-01-2025' }, 'YYYY-MM-DD')
  })
  it('rejects invalid date format for endDate', () => {
    fail(tripSchema, { ...base, endDate: 'not-a-date' }, 'YYYY-MM-DD')
  })
  it('rejects currency not exactly 3 chars (too short)', () => {
    fail(tripSchema, { ...base, currency: 'US' })
  })
  it('rejects currency not exactly 3 chars (too long)', () => {
    fail(tripSchema, { ...base, currency: 'USDD' })
  })
  it('defaults currency to INR when not provided', () => {
    const d = ok(tripSchema, base)
    assert.equal(d.currency, 'INR')
  })
})

// ─── stopSchema ───────────────────────────────────────────────────────────────

describe('stopSchema', () => {
  const base = { tripId: 'trip-1', cityId: 'city-1', startDate: '2025-03-01', endDate: '2025-03-05' }

  it('accepts a valid stop', () => {
    ok(stopSchema, { ...base, notes: 'Great city' })
  })
  it('rejects missing tripId', () => {
    fail(stopSchema, { ...base, tripId: '' })
  })
  it('rejects missing cityId', () => {
    fail(stopSchema, { ...base, cityId: '' }, 'select a city')
  })
  it('rejects endDate before startDate', () => {
    fail(stopSchema, { ...base, startDate: '2025-03-10', endDate: '2025-03-01' }, 'on or after the start date')
  })
  it('accepts same start and end date', () => {
    ok(stopSchema, { ...base, startDate: '2025-03-05', endDate: '2025-03-05' })
  })
  it('rejects notes longer than 2000 chars', () => {
    fail(stopSchema, { ...base, notes: 'x'.repeat(2001) })
  })
  it('treats empty notes as undefined', () => {
    const d = ok(stopSchema, { ...base, notes: '' })
    assert.equal(d.notes, undefined)
  })
})

// ─── stopUpdateSchema ─────────────────────────────────────────────────────────

describe('stopUpdateSchema', () => {
  const base = { stopId: 'stop-abc', startDate: '2025-04-01', endDate: '2025-04-07' }

  it('accepts a valid stop update', () => {
    ok(stopUpdateSchema, base)
  })
  it('rejects missing stopId', () => {
    fail(stopUpdateSchema, { ...base, stopId: '' })
  })
  it('rejects endDate before startDate', () => {
    fail(stopUpdateSchema, { ...base, endDate: '2025-03-31' }, 'on or after the start date')
  })
})

// ─── reorderSchema ────────────────────────────────────────────────────────────

describe('reorderSchema', () => {
  it('accepts valid reorder', () => {
    ok(reorderSchema, { tripId: 'trip-1', order: ['stop-a', 'stop-b'] })
  })
  it('rejects empty tripId', () => {
    fail(reorderSchema, { tripId: '', order: ['stop-a'] })
  })
  it('rejects empty order array', () => {
    fail(reorderSchema, { tripId: 'trip-1', order: [] })
  })
  it('rejects order array with empty string items', () => {
    fail(reorderSchema, { tripId: 'trip-1', order: [''] })
  })
})

// ─── addActivitySchema ────────────────────────────────────────────────────────

describe('addActivitySchema', () => {
  const base = { stopId: 'stop-1', activityId: 'act-1' }

  it('accepts minimal activity', () => {
    ok(addActivitySchema, base)
  })
  it('accepts activity with all optional fields', () => {
    ok(addActivitySchema, { ...base, dayIndex: 2, startTime: '09:30', cost: 500 })
  })
  it('rejects missing stopId', () => {
    fail(addActivitySchema, { ...base, stopId: '' })
  })
  it('rejects missing activityId', () => {
    fail(addActivitySchema, { ...base, activityId: '' })
  })
  it('rejects invalid time format (no colon)', () => {
    fail(addActivitySchema, { ...base, startTime: '0930' }, 'HH:MM')
  })
  it('rejects out-of-range hours (25:00)', () => {
    fail(addActivitySchema, { ...base, startTime: '25:00' }, 'HH:MM')
  })
  it('rejects out-of-range minutes (12:60)', () => {
    fail(addActivitySchema, { ...base, startTime: '12:60' }, 'HH:MM')
  })
  it('accepts boundary time 00:00', () => {
    ok(addActivitySchema, { ...base, startTime: '00:00' })
  })
  it('accepts boundary time 23:59', () => {
    ok(addActivitySchema, { ...base, startTime: '23:59' })
  })
  it('rejects negative cost', () => {
    fail(addActivitySchema, { ...base, cost: -1 })
  })
  it('accepts cost of 0 (free activity)', () => {
    ok(addActivitySchema, { ...base, cost: 0 })
  })
  it('treats empty startTime as undefined', () => {
    const d = ok(addActivitySchema, { ...base, startTime: '' })
    assert.equal(d.startTime, undefined)
  })
  it('rejects negative dayIndex', () => {
    fail(addActivitySchema, { ...base, dayIndex: -1 })
  })
  it('rejects non-integer dayIndex', () => {
    fail(addActivitySchema, { ...base, dayIndex: 1.5 })
  })
})

// ─── updateTripActivitySchema ─────────────────────────────────────────────────

describe('updateTripActivitySchema', () => {
  const base = { id: 'ta-1' }

  it('accepts minimal update (only id)', () => {
    ok(updateTripActivitySchema, base)
  })
  it('accepts full update', () => {
    ok(updateTripActivitySchema, { ...base, dayIndex: 1, startTime: '14:00', cost: 300, note: 'Fun!' })
  })
  it('rejects missing id', () => {
    fail(updateTripActivitySchema, { ...base, id: '' })
  })
  it('rejects invalid startTime', () => {
    fail(updateTripActivitySchema, { ...base, startTime: '99:99' }, 'HH:MM')
  })
  it('rejects note over 500 chars', () => {
    fail(updateTripActivitySchema, { ...base, note: 'x'.repeat(501) })
  })
  it('treats empty note as undefined', () => {
    const d = ok(updateTripActivitySchema, { ...base, note: '' })
    assert.equal(d.note, undefined)
  })
  it('rejects negative cost', () => {
    fail(updateTripActivitySchema, { ...base, cost: -50 })
  })
})

// ─── reorderActivitiesSchema ──────────────────────────────────────────────────

describe('reorderActivitiesSchema', () => {
  it('accepts valid reorder', () => {
    ok(reorderActivitiesSchema, { stopId: 'stop-1', dayIndex: 0, order: ['ta-1', 'ta-2'] })
  })
  it('rejects empty stopId', () => {
    fail(reorderActivitiesSchema, { stopId: '', dayIndex: 0, order: ['ta-1'] })
  })
  it('rejects negative dayIndex', () => {
    fail(reorderActivitiesSchema, { stopId: 'stop-1', dayIndex: -1, order: ['ta-1'] })
  })
  it('rejects empty order array', () => {
    fail(reorderActivitiesSchema, { stopId: 'stop-1', dayIndex: 0, order: [] })
  })
})

// ─── expenseSchema ────────────────────────────────────────────────────────────

describe('expenseSchema', () => {
  const base = { tripId: 'trip-1', category: 'TRANSPORT' as const, label: 'Flight', amount: 5000 }

  it('accepts a valid expense', () => {
    ok(expenseSchema, base)
  })
  it('accepts expense with optional stopId and dayIndex', () => {
    ok(expenseSchema, { ...base, stopId: 'stop-1', dayIndex: 2 })
  })
  it('rejects missing tripId', () => {
    fail(expenseSchema, { ...base, tripId: '' })
  })
  it('rejects missing label', () => {
    fail(expenseSchema, { ...base, label: '' }, 'label is required')
  })
  it('rejects label over 120 chars', () => {
    fail(expenseSchema, { ...base, label: 'x'.repeat(121) })
  })
  it('rejects amount of 0', () => {
    fail(expenseSchema, { ...base, amount: 0 }, 'greater than 0')
  })
  it('rejects negative amount', () => {
    fail(expenseSchema, { ...base, amount: -100 }, 'greater than 0')
  })
  it('accepts all valid category enum values', () => {
    for (const category of ['TRANSPORT', 'STAY', 'ACTIVITY', 'MEAL', 'OTHER'] as const) {
      ok(expenseSchema, { ...base, category })
    }
  })
  it('rejects invalid category', () => {
    fail(expenseSchema, { ...base, category: 'FOOD' })
  })
  it('rejects negative dayIndex', () => {
    fail(expenseSchema, { ...base, dayIndex: -1 })
  })
  it('rejects non-integer dayIndex', () => {
    fail(expenseSchema, { ...base, dayIndex: 1.5 })
  })
  it('treats empty stopId as undefined', () => {
    const d = ok(expenseSchema, { ...base, stopId: '' })
    assert.equal(d.stopId, undefined)
  })
})

// ─── postSchema ───────────────────────────────────────────────────────────────

describe('postSchema', () => {
  const base = { title: 'My Adventure', body: 'It was amazing!', tags: 'travel,adventure' }

  it('accepts a valid post', () => {
    ok(postSchema, base)
  })
  it('rejects empty title', () => {
    fail(postSchema, { ...base, title: '' }, 'title is required')
  })
  it('rejects title over 120 chars', () => {
    fail(postSchema, { ...base, title: 'x'.repeat(121) })
  })
  it('rejects empty body', () => {
    fail(postSchema, { ...base, body: '' }, 'say something')
  })
  it('rejects body over 4000 chars', () => {
    fail(postSchema, { ...base, body: 'x'.repeat(4001) })
  })
  it('parses comma-separated tags into a lowercase array', () => {
    const d = ok(postSchema, { ...base, tags: 'Japan, Travel, #Adventure' })
    assert.deepEqual(d.tags, ['japan', 'travel', 'adventure'])
  })
  it('silently truncates tags to max 6', () => {
    const d = ok(postSchema, { ...base, tags: 'a,b,c,d,e,f,g,h' })
    assert.equal(d.tags.length, 6)
  })
  it('returns empty tags array when tags is not a string', () => {
    const d = ok(postSchema, { ...base, tags: undefined })
    assert.deepEqual(d.tags, [])
  })
  it('strips leading # from tags', () => {
    const d = ok(postSchema, { ...base, tags: '#bali,#food' })
    assert.deepEqual(d.tags, ['bali', 'food'])
  })
  it('treats empty imageUrl as undefined', () => {
    const d = ok(postSchema, { ...base, imageUrl: '' })
    assert.equal(d.imageUrl, undefined)
  })
})

// ─── citySearchSchema ─────────────────────────────────────────────────────────

describe('citySearchSchema', () => {
  it('accepts empty search params (defaults applied)', () => {
    const d = ok(citySearchSchema, {})
    assert.equal(d.groupBy, 'none')
    assert.equal(d.sortBy, 'popularity')
  })
  it('accepts full valid params', () => {
    ok(citySearchSchema, { q: 'Paris', region: 'Europe', country: 'France', maxCostIndex: 50, groupBy: 'region', sortBy: 'cost' })
  })
  it('rejects maxCostIndex above 100', () => {
    fail(citySearchSchema, { maxCostIndex: 101 })
  })
  it('rejects maxCostIndex below 0', () => {
    fail(citySearchSchema, { maxCostIndex: -1 })
  })
  it('rejects invalid groupBy value', () => {
    fail(citySearchSchema, { groupBy: 'country' })
  })
  it('rejects invalid sortBy value', () => {
    fail(citySearchSchema, { sortBy: 'rating' })
  })
  it('coerces string maxCostIndex to number', () => {
    const d = ok(citySearchSchema, { maxCostIndex: '75' })
    assert.equal(d.maxCostIndex, 75)
  })
})

// ─── activitySearchSchema ─────────────────────────────────────────────────────

describe('activitySearchSchema', () => {
  it('accepts empty params with defaults', () => {
    const d = ok(activitySearchSchema, {})
    assert.equal(d.groupBy, 'none')
    assert.equal(d.sortBy, 'popularity')
  })
  it('accepts full valid params', () => {
    ok(activitySearchSchema, { q: 'hiking', type: 'ADVENTURE', maxCost: 1000, maxDuration: 120, maxCostIndex: 60, groupBy: 'type', sortBy: 'cost' })
  })
  it('accepts all valid activity type enum values', () => {
    for (const type of ['SIGHTSEEING', 'FOOD', 'ADVENTURE', 'CULTURE', 'NATURE', 'NIGHTLIFE', 'RELAX', 'SHOPPING'] as const) {
      ok(activitySearchSchema, { type })
    }
  })
  it('rejects invalid activity type', () => {
    fail(activitySearchSchema, { type: 'SPORT' })
  })
  it('rejects invalid sortBy value', () => {
    fail(activitySearchSchema, { sortBy: 'alphabetical' })
  })
  it('rejects invalid groupBy value', () => {
    fail(activitySearchSchema, { groupBy: 'country' })
  })
  it('rejects negative maxCost', () => {
    fail(activitySearchSchema, { maxCost: -1 })
  })
  it('rejects maxCostIndex above 100', () => {
    fail(activitySearchSchema, { maxCostIndex: 101 })
  })
})

// ─── tripListSchema ───────────────────────────────────────────────────────────

describe('tripListSchema', () => {
  it('accepts empty params with defaults', () => {
    const d = ok(tripListSchema, {})
    assert.equal(d.groupBy, 'status')
    assert.equal(d.sort, 'start-desc')
  })
  it('accepts full valid params', () => {
    ok(tripListSchema, { q: 'Asia', status: 'UPCOMING', groupBy: 'month', sort: 'name' })
  })
  it('accepts all valid status values', () => {
    for (const status of ['ONGOING', 'UPCOMING', 'COMPLETED'] as const) {
      ok(tripListSchema, { status })
    }
  })
  it('rejects invalid status', () => {
    fail(tripListSchema, { status: 'CANCELLED' })
  })
  it('rejects invalid sort value', () => {
    fail(tripListSchema, { sort: 'alphabetical' })
  })
  it('rejects invalid groupBy value', () => {
    fail(tripListSchema, { groupBy: 'year' })
  })
})

// ─── communitySearchSchema ────────────────────────────────────────────────────

describe('communitySearchSchema', () => {
  it('accepts empty params with defaults', () => {
    const d = ok(communitySearchSchema, {})
    assert.equal(d.groupBy, 'none')
    assert.equal(d.sort, 'recent')
  })
  it('accepts full valid params', () => {
    ok(communitySearchSchema, { q: 'Bali', tag: 'adventure', groupBy: 'tag', sort: 'likes' })
  })
  it('rejects invalid sort', () => {
    fail(communitySearchSchema, { sort: 'alphabetical' })
  })
  it('rejects invalid groupBy', () => {
    fail(communitySearchSchema, { groupBy: 'country' })
  })
})

// ─── adminSearchSchema ────────────────────────────────────────────────────────

describe('adminSearchSchema', () => {
  it('accepts empty params with defaults', () => {
    const d = ok(adminSearchSchema, {})
    assert.equal(d.groupBy, 'none')
    assert.equal(d.filter, 'all')
    assert.equal(d.sort, 'recent')
  })
  it('accepts full valid params', () => {
    ok(adminSearchSchema, { q: 'John', groupBy: 'status', filter: 'admins', sort: 'name' })
  })
  it('accepts all valid filter values', () => {
    for (const filter of ['all', 'admins', 'active', 'suspended', 'with-trips'] as const) {
      ok(adminSearchSchema, { filter })
    }
  })
  it('rejects invalid filter', () => {
    fail(adminSearchSchema, { filter: 'banned' })
  })
  it('rejects invalid sort', () => {
    fail(adminSearchSchema, { sort: 'popular' })
  })
  it('rejects invalid groupBy', () => {
    fail(adminSearchSchema, { groupBy: 'country' })
  })
})
