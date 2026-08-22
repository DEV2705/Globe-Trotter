import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toNumber, slugify, hashIndex, initials } from './utils.js'

// ─── toNumber ─────────────────────────────────────────────────────────────────

describe('toNumber', () => {
  it('returns 0 for null', () => assert.equal(toNumber(null), 0))
  it('returns 0 for undefined', () => assert.equal(toNumber(undefined), 0))
  it('returns the number as-is for numeric input', () => {
    assert.equal(toNumber(42), 42)
    assert.equal(toNumber(3.14), 3.14)
    assert.equal(toNumber(-7), -7)
    assert.equal(toNumber(0), 0)
  })
  it('converts a numeric string to a number', () => {
    assert.equal(toNumber('99'), 99)
    assert.equal(toNumber('3.14'), 3.14)
  })
  it('calls .toNumber() on Decimal-shaped objects', () => {
    const fakeDecimal = { toNumber: () => 123.45 }
    assert.equal(toNumber(fakeDecimal), 123.45)
  })
  it('handles Decimal-shaped object returning 0', () => {
    const fakeDecimal = { toNumber: () => 0 }
    assert.equal(toNumber(fakeDecimal), 0)
  })
  it('converts boolean true to 1', () => {
    assert.equal(toNumber(true), 1)
  })
  it('converts boolean false to 0', () => {
    assert.equal(toNumber(false), 0)
  })
  it('converts empty string to 0', () => {
    assert.equal(toNumber(''), 0)
  })
})

// ─── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases the input', () => {
    assert.equal(slugify('HELLO'), 'hello')
  })
  it('replaces spaces with hyphens', () => {
    assert.equal(slugify('hello world'), 'hello-world')
  })
  it('removes leading and trailing hyphens', () => {
    assert.equal(slugify(' hello '), 'hello')
  })
  it('collapses multiple spaces/symbols into a single hyphen', () => {
    assert.equal(slugify('a   b'), 'a-b')
  })
  it('strips special characters', () => {
    assert.equal(slugify('café & food!'), 'caf-food')
  })
  it('handles an already-valid slug', () => {
    assert.equal(slugify('my-trip-2025'), 'my-trip-2025')
  })
  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(80)
    assert.equal(slugify(long).length, 60)
  })
  it('returns empty string for empty input', () => {
    assert.equal(slugify(''), '')
  })
  it('strips leading and trailing hyphens after special char removal', () => {
    assert.equal(slugify('!!hello!!'), 'hello')
  })
  it('handles numbers', () => {
    assert.equal(slugify('Top 10 Places'), 'top-10-places')
  })
})

// ─── hashIndex ────────────────────────────────────────────────────────────────

describe('hashIndex', () => {
  it('always returns a value in [0, buckets - 1]', () => {
    const buckets = 7
    for (const key of ['a', 'b', 'hello', 'world', 'test-123', '']) {
      const idx = hashIndex(key, buckets)
      assert.ok(idx >= 0 && idx < buckets, `${key} → ${idx} out of [0, ${buckets - 1}]`)
    }
  })
  it('is deterministic: same key always returns same index', () => {
    assert.equal(hashIndex('globe-trotter', 10), hashIndex('globe-trotter', 10))
  })
  it('distributes differently for different keys (not always zero)', () => {
    const results = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((k) => hashIndex(k, 100)))
    // highly unlikely all 5 map to the same bucket
    assert.ok(results.size > 1)
  })
  it('handles empty string key without throwing', () => {
    assert.doesNotThrow(() => hashIndex('', 5))
  })
  it('works with 1 bucket (always returns 0)', () => {
    assert.equal(hashIndex('anything', 1), 0)
  })
})

// ─── initials ─────────────────────────────────────────────────────────────────

describe('initials', () => {
  it('returns two uppercase initials for first and last name', () => {
    assert.equal(initials('Jane', 'Doe'), 'JD')
  })
  it('returns single initial when lastName is omitted', () => {
    assert.equal(initials('Jane'), 'J')
  })
  it('returns single initial when lastName is null', () => {
    assert.equal(initials('Jane', null), 'J')
  })
  it('returns single initial when lastName is empty string', () => {
    assert.equal(initials('Jane', ''), 'J')
  })
  it('uppercases lowercase names', () => {
    assert.equal(initials('alice', 'smith'), 'AS')
  })
  it('returns "?" when firstName is empty', () => {
    assert.equal(initials('', ''), '?')
  })
  it('handles single-char names', () => {
    assert.equal(initials('A', 'B'), 'AB')
  })
})
