import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  budgetFromTrip,
  emptyBudget,
  currencySymbol,
  formatMoney,
  formatMoneyShort,
  formatDuration,
  NEAR_CAP_RATIO,
  type BudgetTripInput,
} from './budget.js'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal BudgetTripInput with sensible defaults. */
function makeTrip(overrides: Partial<BudgetTripInput> = {}): BudgetTripInput {
  const totalDays = overrides.totalDays ?? 3
  return {
    totalDays,
    dayDates: Array.from({ length: totalDays }, (_, i) => `2025-06-0${i + 1}`),
    budgetCap: null,
    currency: 'INR',
    stops: [],
    activities: [],
    expenses: [],
    ...overrides,
  }
}

// ─── emptyBudget ──────────────────────────────────────────────────────────────

describe('emptyBudget', () => {
  it('returns zero total', () => {
    assert.equal(emptyBudget().total, 0)
  })
  it('defaults to INR currency', () => {
    assert.equal(emptyBudget().currency, 'INR')
  })
  it('accepts a custom currency', () => {
    assert.equal(emptyBudget('USD').currency, 'USD')
  })
  it('returns capStatus of "under" with no budget set', () => {
    assert.equal(emptyBudget().capStatus, 'under')
  })
  it('has null remaining and capUsedPct when no cap is set', () => {
    const b = emptyBudget()
    assert.equal(b.remaining, null)
    assert.equal(b.capUsedPct, null)
  })
  it('has all 5 categories with amount 0', () => {
    const b = emptyBudget()
    assert.equal(b.byCategory.length, 5)
    assert.ok(b.byCategory.every((c) => c.amount === 0))
  })
})

// ─── budgetFromTrip — zero-day guard ──────────────────────────────────────────

describe('budgetFromTrip — zero/negative totalDays guard', () => {
  it('returns emptyBudget when totalDays is 0', () => {
    const r = budgetFromTrip(makeTrip({ totalDays: 0, dayDates: [] }))
    assert.equal(r.total, 0)
  })
  it('returns emptyBudget when totalDays is negative', () => {
    const r = budgetFromTrip(makeTrip({ totalDays: -1, dayDates: [] }))
    assert.equal(r.total, 0)
  })
})

// ─── budgetFromTrip — activity costs ─────────────────────────────────────────

describe('budgetFromTrip — activities', () => {
  it('sums activity costs into total', () => {
    const r = budgetFromTrip(makeTrip({
      activities: [
        { dayIndex: 0, cost: 500, stopId: '' },
        { dayIndex: 1, cost: 300, stopId: '' },
      ],
    }))
    assert.equal(r.total, 800)
  })

  it('assigns activity cost to the correct day', () => {
    const r = budgetFromTrip(makeTrip({
      activities: [{ dayIndex: 1, cost: 200, stopId: '' }],
    }))
    assert.equal(r.byDay[0].amount, 0)
    assert.equal(r.byDay[1].amount, 200)
    assert.equal(r.byDay[2].amount, 0)
  })

  it('clamps out-of-range dayIndex to last valid day', () => {
    const r = budgetFromTrip(makeTrip({
      totalDays: 3,
      activities: [{ dayIndex: 99, cost: 100, stopId: '' }],
    }))
    assert.equal(r.byDay[2].amount, 100) // clamped to day 2
  })

  it('accumulates activity costs into ACTIVITY category', () => {
    const r = budgetFromTrip(makeTrip({
      activities: [{ dayIndex: 0, cost: 750, stopId: '' }],
    }))
    const actCat = r.byCategory.find((c) => c.category === 'ACTIVITY')!
    assert.equal(actCat.amount, 750)
  })

  it('accumulates activity cost into the owning stop total', () => {
    const r = budgetFromTrip(makeTrip({
      stops: [{ id: 's1', city: 'Bangkok', startDayIndex: 0, endDayIndex: 2 }],
      activities: [{ dayIndex: 0, cost: 400, stopId: 's1' }],
    }))
    assert.equal(r.byStop[0].amount, 400)
  })

  it('ignores activity cost for unknown stopId (does not throw)', () => {
    const r = budgetFromTrip(makeTrip({
      stops: [{ id: 's1', city: 'Bangkok', startDayIndex: 0, endDayIndex: 2 }],
      activities: [{ dayIndex: 0, cost: 200, stopId: 'nonexistent' }],
    }))
    assert.equal(r.byStop[0].amount, 0) // s1 untouched
    assert.equal(r.total, 200) // but total still counted
  })
})

// ─── budgetFromTrip — expense costs ──────────────────────────────────────────

describe('budgetFromTrip — expenses', () => {
  it('adds expense with dayIndex to the correct day', () => {
    const r = budgetFromTrip(makeTrip({
      expenses: [{ category: 'MEAL', amount: 300, dayIndex: 2, stopId: null }],
    }))
    assert.equal(r.byDay[2].amount, 300)
    assert.equal(r.byDay[0].amount, 0)
  })

  it('accumulates expense into the correct category', () => {
    const r = budgetFromTrip(makeTrip({
      expenses: [{ category: 'TRANSPORT', amount: 1000, dayIndex: 0, stopId: null }],
    }))
    const cat = r.byCategory.find((c) => c.category === 'TRANSPORT')!
    assert.equal(cat.amount, 1000)
  })

  it('spreads null-dayIndex expense evenly across all trip days', () => {
    const r = budgetFromTrip(makeTrip({
      totalDays: 3,
      expenses: [{ category: 'STAY', amount: 3000, dayIndex: null, stopId: null }],
    }))
    // 3000 / 3 days = 1000 per day
    assert.equal(r.byDay[0].amount, 1000)
    assert.equal(r.byDay[1].amount, 1000)
    assert.equal(r.byDay[2].amount, 1000)
  })

  it('spreads null-dayIndex stop-level expense across stop days only', () => {
    const r = budgetFromTrip(makeTrip({
      totalDays: 4,
      dayDates: ['2025-06-01', '2025-06-02', '2025-06-03', '2025-06-04'],
      stops: [{ id: 's1', city: 'BKK', startDayIndex: 0, endDayIndex: 1 }],
      expenses: [{ category: 'STAY', amount: 2000, dayIndex: null, stopId: 's1' }],
    }))
    assert.equal(r.byDay[0].amount, 1000) // 2000 / 2 days
    assert.equal(r.byDay[1].amount, 1000)
    assert.equal(r.byDay[2].amount, 0)    // outside stop range
    assert.equal(r.byDay[3].amount, 0)
  })

  it('adds null-dayIndex expense amount to its stop total', () => {
    const r = budgetFromTrip(makeTrip({
      stops: [{ id: 's1', city: 'BKK', startDayIndex: 0, endDayIndex: 2 }],
      expenses: [{ category: 'STAY', amount: 3000, dayIndex: null, stopId: 's1' }],
    }))
    assert.equal(r.byStop[0].amount, 3000)
  })
})

// ─── budgetFromTrip — totals and averages ────────────────────────────────────

describe('budgetFromTrip — totals and averages', () => {
  it('total = sum of all activities + all expenses', () => {
    const r = budgetFromTrip(makeTrip({
      activities: [{ dayIndex: 0, cost: 200, stopId: '' }],
      expenses: [
        { category: 'STAY', amount: 1000, dayIndex: null, stopId: null },
        { category: 'TRANSPORT', amount: 500, dayIndex: 2, stopId: null },
      ],
    }))
    assert.equal(r.total, 1700)
  })

  it('avgPerDay = total / totalDays (rounded to 2dp)', () => {
    const r = budgetFromTrip(makeTrip({
      totalDays: 3,
      activities: [{ dayIndex: 0, cost: 1000, stopId: '' }],
    }))
    assert.equal(r.avgPerDay, 333.33)
  })

  it('category percentages sum to 100 when total > 0', () => {
    const r = budgetFromTrip(makeTrip({
      expenses: [
        { category: 'STAY', amount: 500, dayIndex: null, stopId: null },
        { category: 'TRANSPORT', amount: 500, dayIndex: null, stopId: null },
      ],
    }))
    const sum = r.byCategory.reduce((a, c) => a + c.pct, 0)
    assert.ok(Math.abs(sum - 100) < 0.01, `Expected pct sum ~100, got ${sum}`)
  })

  it('all category percentages are 0 when total is 0', () => {
    const r = budgetFromTrip(makeTrip())
    assert.ok(r.byCategory.every((c) => c.pct === 0))
  })
})

// ─── budgetFromTrip — capStatus ───────────────────────────────────────────────

describe('budgetFromTrip — capStatus', () => {
  it('capStatus is "under" when no budget cap is set', () => {
    const r = budgetFromTrip(makeTrip({
      activities: [{ dayIndex: 0, cost: 5000, stopId: '' }],
    }))
    assert.equal(r.capStatus, 'under')
    assert.equal(r.remaining, null)
  })

  it('capStatus is "under" when spend is well below cap', () => {
    const r = budgetFromTrip(makeTrip({
      budgetCap: 10000,
      activities: [{ dayIndex: 0, cost: 1000, stopId: '' }],
    }))
    assert.equal(r.capStatus, 'under')
  })

  it(`capStatus is "near" when spend >= ${NEAR_CAP_RATIO * 100}% of cap`, () => {
    // 8500 / 10000 = 85% which is exactly NEAR_CAP_RATIO
    const r = budgetFromTrip(makeTrip({
      budgetCap: 10000,
      activities: [{ dayIndex: 0, cost: 8500, stopId: '' }],
    }))
    assert.equal(r.capStatus, 'near')
  })

  it('capStatus is "over" when spend exceeds cap', () => {
    const r = budgetFromTrip(makeTrip({
      budgetCap: 500,
      activities: [{ dayIndex: 0, cost: 1000, stopId: '' }],
    }))
    assert.equal(r.capStatus, 'over')
  })

  it('remaining = budgetCap - total', () => {
    const r = budgetFromTrip(makeTrip({
      budgetCap: 5000,
      activities: [{ dayIndex: 0, cost: 2000, stopId: '' }],
    }))
    assert.equal(r.remaining, 3000)
  })

  it('remaining is negative when over budget', () => {
    const r = budgetFromTrip(makeTrip({
      budgetCap: 1000,
      activities: [{ dayIndex: 0, cost: 2000, stopId: '' }],
    }))
    assert.equal(r.remaining, -1000)
  })

  it('capUsedPct is correct percentage', () => {
    const r = budgetFromTrip(makeTrip({
      budgetCap: 10000,
      activities: [{ dayIndex: 0, cost: 2500, stopId: '' }],
    }))
    assert.equal(r.capUsedPct, 25)
  })
})

// ─── budgetFromTrip — overBudgetDays ─────────────────────────────────────────

describe('budgetFromTrip — overBudgetDays', () => {
  it('returns empty array when no days exceed daily cap', () => {
    const r = budgetFromTrip(makeTrip({
      totalDays: 3,
      budgetCap: 9000, // 3000/day cap
      activities: [{ dayIndex: 0, cost: 1000, stopId: '' }],
    }))
    assert.deepEqual(r.overBudgetDays, [])
  })

  it('flags days that exceed the daily cap', () => {
    const r = budgetFromTrip(makeTrip({
      totalDays: 3,
      budgetCap: 3000, // 1000/day cap
      activities: [
        { dayIndex: 0, cost: 500, stopId: '' },
        { dayIndex: 1, cost: 2000, stopId: '' }, // over!
      ],
    }))
    assert.ok(r.overBudgetDays.includes(1))
    assert.ok(!r.overBudgetDays.includes(0))
  })

  it('byDay.overCap mirrors overBudgetDays', () => {
    const r = budgetFromTrip(makeTrip({
      totalDays: 3,
      budgetCap: 3000,
      activities: [{ dayIndex: 2, cost: 2000, stopId: '' }],
    }))
    assert.equal(r.byDay[2].overCap, true)
    assert.equal(r.byDay[0].overCap, false)
  })
})

// ─── budgetFromTrip — dailyCap ────────────────────────────────────────────────

describe('budgetFromTrip — dailyCap', () => {
  it('dailyCap is null when no budgetCap', () => {
    const r = budgetFromTrip(makeTrip())
    assert.equal(r.dailyCap, null)
  })

  it('dailyCap = budgetCap / totalDays', () => {
    const r = budgetFromTrip(makeTrip({ totalDays: 4, budgetCap: 8000, dayDates: ['a', 'b', 'c', 'd'] }))
    assert.equal(r.dailyCap, 2000)
  })
})

// ─── currencySymbol ───────────────────────────────────────────────────────────

describe('currencySymbol', () => {
  it('returns ₹ for INR', () => assert.equal(currencySymbol('INR'), '₹'))
  it('returns $ for USD', () => assert.equal(currencySymbol('USD'), '$'))
  it('returns € for EUR', () => assert.equal(currencySymbol('EUR'), '€'))
  it('returns £ for GBP', () => assert.equal(currencySymbol('GBP'), '£'))
  it('falls back to currency code for unknown currencies', () => {
    assert.equal(currencySymbol('JPY'), 'JPY')
  })
})

// ─── formatMoneyShort ─────────────────────────────────────────────────────────

describe('formatMoneyShort', () => {
  it('formats amounts under 1000 as plain number with symbol', () => {
    assert.equal(formatMoneyShort(500), '₹500')
  })
  it('formats thousands as k (1 decimal)', () => {
    assert.equal(formatMoneyShort(12500), '₹12.5k')
  })
  it('formats lakhs as L (1 decimal)', () => {
    assert.equal(formatMoneyShort(150000), '₹1.5L')
  })
  it('formats crores as Cr (1 decimal)', () => {
    assert.equal(formatMoneyShort(20000000), '₹2.0Cr')
  })
  it('handles negative amounts with leading minus', () => {
    assert.ok(formatMoneyShort(-5000).startsWith('-'))
  })
  it('uses correct symbol for USD', () => {
    assert.ok(formatMoneyShort(1500, 'USD').includes('$'))
  })
  it('formats exactly 0', () => {
    assert.equal(formatMoneyShort(0), '₹0')
  })
})

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats minutes only when under 60', () => {
    assert.equal(formatDuration(45), '45m')
  })
  it('formats whole hours with no minutes', () => {
    assert.equal(formatDuration(120), '2h')
  })
  it('formats hours and minutes', () => {
    assert.equal(formatDuration(150), '2h 30m')
  })
  it('formats exactly 60 min as 1h', () => {
    assert.equal(formatDuration(60), '1h')
  })
  it('formats 0 minutes', () => {
    assert.equal(formatDuration(0), '0m')
  })
  it('formats 1 minute', () => {
    assert.equal(formatDuration(1), '1m')
  })
})
