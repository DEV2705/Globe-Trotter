import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  utcDay,
  parseDateInput,
  toDateInput,
  tripLength,
  eachDayOfTrip,
  dayIndexFor,
  dateForDayIndex,
  isSameUtcDay,
  deriveStatus,
  daysUntil,
  isInRange,
  monthGrid,
} from './dates.js'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string to a UTC-midnight Date. */
function d(str: string): Date {
  return parseDateInput(str)
}

// ─── utcDay ───────────────────────────────────────────────────────────────────

describe('utcDay', () => {
  it('returns UTC midnight for a given Date', () => {
    const result = utcDay(new Date('2025-06-15T12:34:56Z'))
    assert.equal(result.getUTCHours(), 0)
    assert.equal(result.getUTCMinutes(), 0)
    assert.equal(result.getUTCDate(), 15)
    assert.equal(result.getUTCMonth(), 5) // 0-based
    assert.equal(result.getUTCFullYear(), 2025)
  })
  it('accepts a date string', () => {
    const result = utcDay('2025-01-01')
    assert.equal(result.getUTCFullYear(), 2025)
    assert.equal(result.getUTCMonth(), 0)
    assert.equal(result.getUTCDate(), 1)
  })
  it('accepts a numeric timestamp', () => {
    const ts = Date.UTC(2025, 5, 20)
    const result = utcDay(ts)
    assert.equal(result.getUTCDate(), 20)
  })
})

// ─── parseDateInput ───────────────────────────────────────────────────────────

describe('parseDateInput', () => {
  it('parses YYYY-MM-DD as UTC midnight', () => {
    const result = parseDateInput('2025-03-15')
    assert.equal(result.getUTCFullYear(), 2025)
    assert.equal(result.getUTCMonth(), 2) // 0-based
    assert.equal(result.getUTCDate(), 15)
    assert.equal(result.getUTCHours(), 0)
  })
  it('handles Jan (month 01)', () => {
    const result = parseDateInput('2025-01-01')
    assert.equal(result.getUTCMonth(), 0)
    assert.equal(result.getUTCDate(), 1)
  })
  it('handles Dec (month 12)', () => {
    const result = parseDateInput('2025-12-31')
    assert.equal(result.getUTCMonth(), 11)
    assert.equal(result.getUTCDate(), 31)
  })
})

// ─── toDateInput ──────────────────────────────────────────────────────────────

describe('toDateInput', () => {
  it('returns YYYY-MM-DD string from UTC-midnight Date', () => {
    assert.equal(toDateInput(d('2025-06-05')), '2025-06-05')
  })
  it('zero-pads single-digit month', () => {
    assert.equal(toDateInput(d('2025-01-09')), '2025-01-09')
  })
  it('zero-pads single-digit day', () => {
    assert.equal(toDateInput(d('2025-11-04')), '2025-11-04')
  })
  it('roundtrips correctly: parseDateInput → toDateInput', () => {
    const original = '2026-08-22'
    assert.equal(toDateInput(parseDateInput(original)), original)
  })
})

// ─── tripLength ───────────────────────────────────────────────────────────────

describe('tripLength', () => {
  it('returns 1 for a same-day trip', () => {
    assert.equal(tripLength(d('2025-06-01'), d('2025-06-01')), 1)
  })
  it('returns correct length for a multi-day trip', () => {
    assert.equal(tripLength(d('2025-06-01'), d('2025-06-10')), 10)
  })
  it('returns 14 for a 2-week trip', () => {
    assert.equal(tripLength(d('2025-01-01'), d('2025-01-14')), 14)
  })
  it('returns 365 for a full year trip (non-leap)', () => {
    assert.equal(tripLength(d('2025-01-01'), d('2025-12-31')), 365)
  })
  it('returns 366 for a leap year trip', () => {
    assert.equal(tripLength(d('2024-01-01'), d('2024-12-31')), 366)
  })
})

// ─── eachDayOfTrip ────────────────────────────────────────────────────────────

describe('eachDayOfTrip', () => {
  it('returns a single date for a same-day trip', () => {
    const days = eachDayOfTrip(d('2025-06-01'), d('2025-06-01'))
    assert.equal(days.length, 1)
    assert.equal(toDateInput(days[0]), '2025-06-01')
  })
  it('returns all inclusive days for a 3-day trip', () => {
    const days = eachDayOfTrip(d('2025-06-01'), d('2025-06-03'))
    assert.equal(days.length, 3)
    assert.equal(toDateInput(days[0]), '2025-06-01')
    assert.equal(toDateInput(days[1]), '2025-06-02')
    assert.equal(toDateInput(days[2]), '2025-06-03')
  })
  it('crosses month boundaries correctly', () => {
    const days = eachDayOfTrip(d('2025-01-30'), d('2025-02-02'))
    assert.equal(days.length, 4)
    assert.equal(toDateInput(days[2]), '2025-02-01')
  })
})

// ─── dayIndexFor ──────────────────────────────────────────────────────────────

describe('dayIndexFor', () => {
  it('returns 0 for the trip start date', () => {
    assert.equal(dayIndexFor(d('2025-06-01'), d('2025-06-01')), 0)
  })
  it('returns correct index for a date within the trip', () => {
    assert.equal(dayIndexFor(d('2025-06-01'), d('2025-06-05')), 4)
  })
  it('returns -1 for a date before trip start', () => {
    assert.equal(dayIndexFor(d('2025-06-10'), d('2025-06-05')), -1)
  })
  it('returns index matching tripLength - 1 for the end date', () => {
    const start = d('2025-06-01')
    const end = d('2025-06-14')
    assert.equal(dayIndexFor(start, end), 13)
  })
})

// ─── dateForDayIndex ──────────────────────────────────────────────────────────

describe('dateForDayIndex', () => {
  it('returns tripStart for index 0', () => {
    assert.equal(toDateInput(dateForDayIndex(d('2025-06-01'), 0)), '2025-06-01')
  })
  it('returns the correct date for a positive index', () => {
    assert.equal(toDateInput(dateForDayIndex(d('2025-06-01'), 6)), '2025-06-07')
  })
  it('roundtrips with dayIndexFor: dayIndexFor(start, dateForDayIndex(start, i)) === i', () => {
    const start = d('2025-06-01')
    for (const i of [0, 3, 10, 99]) {
      const date = dateForDayIndex(start, i)
      assert.equal(dayIndexFor(start, date), i)
    }
  })
})

// ─── isSameUtcDay ─────────────────────────────────────────────────────────────

describe('isSameUtcDay', () => {
  it('returns true for the same date', () => {
    assert.equal(isSameUtcDay(d('2025-06-15'), d('2025-06-15')), true)
  })
  it('returns false for different dates', () => {
    assert.equal(isSameUtcDay(d('2025-06-15'), d('2025-06-16')), false)
  })
  it('is symmetric', () => {
    const a = d('2025-03-01')
    const b = d('2025-03-02')
    assert.equal(isSameUtcDay(a, b), isSameUtcDay(b, a))
  })
})

// ─── deriveStatus ─────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  it('returns UPCOMING for a trip that starts in the future', () => {
    // far-future trip
    const start = d('2099-01-01')
    const end = d('2099-01-10')
    assert.equal(deriveStatus(start, end), 'UPCOMING')
  })
  it('returns COMPLETED for a trip that ended in the past', () => {
    const start = d('2000-01-01')
    const end = d('2000-01-10')
    assert.equal(deriveStatus(start, end), 'COMPLETED')
  })
  it('returns ONGOING for a trip that spans today', () => {
    // Build a trip that started yesterday and ends tomorrow
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = now.getUTCDate()
    const yesterday = d(`${y}-${m}-${String(day - 1).padStart(2, '0')}`)
    const tomorrow = d(`${y}-${m}-${String(day + 1).padStart(2, '0')}`)
    // Guard: skip if day is 1st or last day of month (edge case for yesterday/tomorrow crossing months)
    if (day > 1 && day < 28) {
      assert.equal(deriveStatus(yesterday, tomorrow), 'ONGOING')
    }
  })
})

// ─── daysUntil ────────────────────────────────────────────────────────────────

describe('daysUntil', () => {
  it('returns a positive number for a future date', () => {
    const future = d('2099-12-31')
    assert.ok(daysUntil(future) > 0)
  })
  it('returns a negative number for a past date', () => {
    const past = d('2000-01-01')
    assert.ok(daysUntil(past) < 0)
  })
})

// ─── isInRange ────────────────────────────────────────────────────────────────

describe('isInRange', () => {
  const start = d('2025-06-01')
  const end = d('2025-06-10')

  it('returns true for the start date', () => {
    assert.equal(isInRange(start, start, end), true)
  })
  it('returns true for the end date', () => {
    assert.equal(isInRange(end, start, end), true)
  })
  it('returns true for a date in the middle', () => {
    assert.equal(isInRange(d('2025-06-05'), start, end), true)
  })
  it('returns false for a date before start', () => {
    assert.equal(isInRange(d('2025-05-31'), start, end), false)
  })
  it('returns false for a date after end', () => {
    assert.equal(isInRange(d('2025-06-11'), start, end), false)
  })
})

// ─── monthGrid ────────────────────────────────────────────────────────────────

describe('monthGrid', () => {
  it('returns an array of weeks (each 7 days)', () => {
    const grid = monthGrid(d('2025-06-15'))
    assert.ok(grid.length >= 4)
    assert.ok(grid.every((week) => week.length === 7))
  })
  it('first cell is a Monday (UTC getDay() === 1)', () => {
    const grid = monthGrid(d('2025-06-15'))
    assert.equal(grid[0][0].getUTCDay(), 1)
  })
  it('last cell is a Sunday (UTC getDay() === 0)', () => {
    const grid = monthGrid(d('2025-06-15'))
    const lastWeek = grid[grid.length - 1]
    assert.equal(lastWeek[6].getUTCDay(), 0)
  })
  it('grid contains all days of the anchor month', () => {
    const grid = monthGrid(d('2025-06-15'))
    const allDates = grid.flat().map((d) => toDateInput(d))
    for (let day = 1; day <= 30; day++) {
      assert.ok(allDates.includes(`2025-06-${String(day).padStart(2, '0')}`), `Missing 2025-06-${day}`)
    }
  })
  it('produces 6 weeks for March 2025 (starts Saturday in a Monday-first grid)', () => {
    // March 1 2025 = Saturday → Monday-first grid starts Feb 24,
    // March 31 = Monday → grid ends Apr 6 (Sunday) → 6 full weeks.
    const grid = monthGrid(d('2025-03-01'))
    assert.equal(grid.length, 6)
  })
  it('produces 4 weeks for February 2021 (starts Monday, exactly 28 days)', () => {
    // Feb 1 2021 = Monday, 28 days → grid starts Feb 1, ends Feb 28 (Sunday) → 4 weeks.
    const grid = monthGrid(d('2021-02-01'))
    assert.equal(grid.length, 4)
  })
})
