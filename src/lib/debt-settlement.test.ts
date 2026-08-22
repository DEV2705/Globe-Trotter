import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeBalances,
  minimalTransfers,
  settleExpenses,
  type SettlementExpense,
  type SettlementMember,
} from './debt-settlement.js'

// ─── helpers ──────────────────────────────────────────────────────────────────

const A: SettlementMember = { id: 'a', name: 'Saumya' }
const B: SettlementMember = { id: 'b', name: 'Rohan' }
const C: SettlementMember = { id: 'c', name: 'Priya' }

function expense(over: Partial<SettlementExpense> = {}): SettlementExpense {
  return { id: 'e1', amount: 300, paidById: 'a', splits: [], ...over }
}

/** Balances must always net to zero — every rupee paid is a rupee owed by someone. */
function assertNetsToZero(nets: number[]) {
  const sum = nets.reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(sum) < 0.005, `balances should net to zero, got ${sum}`)
}

// ─── computeBalances ──────────────────────────────────────────────────────────

describe('computeBalances', () => {
  it('splits equally when no explicit splits are given', () => {
    const balances = computeBalances([A, B, C], [expense({ amount: 300, paidById: 'a' })])

    assert.deepEqual(
      balances.map((b) => [b.name, b.paid, b.owed, b.net]),
      [
        ['Saumya', 300, 100, 200],
        ['Rohan', 0, 100, -100],
        ['Priya', 0, 100, -100],
      ]
    )
  })

  it('honours explicit unequal splits', () => {
    const balances = computeBalances(
      [A, B],
      [
        expense({
          amount: 1000,
          paidById: 'a',
          splits: [
            { memberId: 'a', amount: 250 },
            { memberId: 'b', amount: 750 },
          ],
        }),
      ]
    )

    assert.equal(balances[0].net, 750)
    assert.equal(balances[1].net, -750)
  })

  it('ignores expenses with no payer', () => {
    const balances = computeBalances([A, B], [expense({ amount: 500, paidById: null })])
    assert.deepEqual(balances.map((b) => b.net), [0, 0])
  })

  it('ignores a payer who is not a member', () => {
    const balances = computeBalances([A, B], [expense({ amount: 500, paidById: 'ghost' })])
    assert.deepEqual(balances.map((b) => b.net), [0, 0])
  })

  it('drops split entries for unknown members but still charges the full amount', () => {
    const balances = computeBalances(
      [A, B],
      [
        expense({
          amount: 100,
          paidById: 'a',
          splits: [
            { memberId: 'b', amount: 50 },
            { memberId: 'ghost', amount: 50 },
          ],
        }),
      ]
    )

    // Only B remains, so B carries the whole 100 — nothing may silently vanish.
    assert.equal(balances[1].owed, 100)
    assertNetsToZero(balances.map((b) => b.net))
  })

  it('scales explicit splits that do not add up to the expense total', () => {
    const balances = computeBalances(
      [A, B],
      [
        expense({
          amount: 200,
          paidById: 'a',
          splits: [
            { memberId: 'a', amount: 1 },
            { memberId: 'b', amount: 1 },
          ],
        }),
      ]
    )

    assert.equal(balances[0].owed, 100)
    assert.equal(balances[1].owed, 100)
    assertNetsToZero(balances.map((b) => b.net))
  })

  it('spreads an indivisible amount without losing a paisa', () => {
    const balances = computeBalances([A, B, C], [expense({ amount: 100, paidById: 'a' })])

    const owed = balances.map((b) => b.owed)
    assert.deepEqual(owed, [33.34, 33.33, 33.33])
    assert.equal(owed.reduce((a, b) => a + b, 0), 100)
    assertNetsToZero(balances.map((b) => b.net))
  })

  it('accumulates across several expenses with different payers', () => {
    const balances = computeBalances(
      [A, B],
      [
        expense({ id: 'e1', amount: 100, paidById: 'a' }),
        expense({ id: 'e2', amount: 60, paidById: 'b' }),
      ]
    )

    assert.equal(balances[0].net, 20) // paid 100, owes 80
    assert.equal(balances[1].net, -20)
  })

  it('returns zeroed rows when there are no expenses', () => {
    const balances = computeBalances([A, B], [])
    assert.deepEqual(balances.map((b) => [b.paid, b.owed, b.net]), [[0, 0, 0], [0, 0, 0]])
  })
})

// ─── minimalTransfers ─────────────────────────────────────────────────────────

describe('minimalTransfers', () => {
  it('produces one transfer for a simple two-person debt', () => {
    const transfers = minimalTransfers(computeBalances([A, B], [expense({ amount: 6400, paidById: 'b' })]))

    assert.equal(transfers.length, 1)
    assert.deepEqual(
      { from: transfers[0].from, to: transfers[0].to, amount: transfers[0].amount },
      { from: 'Saumya', to: 'Rohan', amount: 3200 }
    )
  })

  it('settles three people in two transfers, not three', () => {
    const transfers = minimalTransfers(
      computeBalances([A, B, C], [expense({ amount: 300, paidById: 'a' })])
    )

    assert.equal(transfers.length, 2)
    assert.ok(transfers.every((t) => t.to === 'Saumya'))
    assert.equal(transfers.reduce((sum, t) => sum + t.amount, 0), 200)
  })

  it('nets mutual debts away instead of moving money both directions', () => {
    const transfers = minimalTransfers(
      computeBalances(
        [A, B],
        [
          expense({ id: 'e1', amount: 100, paidById: 'a' }),
          expense({ id: 'e2', amount: 100, paidById: 'b' }),
        ]
      )
    )

    assert.deepEqual(transfers, [])
  })

  it('emits nothing when everyone is square', () => {
    assert.deepEqual(minimalTransfers([]), [])
    assert.deepEqual(
      minimalTransfers([{ memberId: 'a', name: 'Saumya', paid: 50, owed: 50, net: 0 }]),
      []
    )
  })

  it('does not emit a transfer for sub-paisa rounding noise', () => {
    const transfers = minimalTransfers([
      { memberId: 'a', name: 'Saumya', paid: 100, owed: 99.996, net: 0.004 },
      { memberId: 'b', name: 'Rohan', paid: 0, owed: 0.004, net: -0.004 },
    ])

    assert.deepEqual(transfers, [])
  })

  it('never needs more transfers than people minus one', () => {
    const members = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, name: `M${i}` }))
    const expenses = members.map((m, i) =>
      expense({ id: `e${i}`, amount: (i + 1) * 137, paidById: m.id })
    )

    const transfers = minimalTransfers(computeBalances(members, expenses))
    assert.ok(
      transfers.length <= members.length - 1,
      `expected at most 5 transfers, got ${transfers.length}`
    )
  })

  it('carries the currency onto every transfer', () => {
    const transfers = minimalTransfers(
      computeBalances([A, B], [expense({ amount: 100, paidById: 'a' })]),
      'EUR'
    )
    assert.equal(transfers[0].currency, 'EUR')
  })
})

// ─── settleExpenses ───────────────────────────────────────────────────────────

describe('settleExpenses', () => {
  it('clears every balance once the transfers are applied', () => {
    const members = [A, B, C]
    const expenses = [
      expense({ id: 'e1', amount: 4500, paidById: 'a' }),
      expense({ id: 'e2', amount: 1200, paidById: 'b' }),
      expense({
        id: 'e3',
        amount: 900,
        paidById: 'c',
        splits: [
          { memberId: 'a', amount: 600 },
          { memberId: 'b', amount: 300 },
        ],
      }),
    ]

    const { balances, transfers, totalSettled } = settleExpenses(members, expenses)
    assert.equal(totalSettled, 6600)

    const net = new Map(balances.map((b) => [b.memberId, b.net]))
    for (const t of transfers) {
      net.set(t.fromId, (net.get(t.fromId) ?? 0) + t.amount)
      net.set(t.toId, (net.get(t.toId) ?? 0) - t.amount)
    }
    for (const [id, remaining] of net) {
      assert.ok(Math.abs(remaining) < 0.02, `${id} left with ${remaining}`)
    }
  })

  it('excludes unpaid expenses from the settled total', () => {
    const { totalSettled } = settleExpenses(
      [A, B],
      [expense({ id: 'e1', amount: 500, paidById: 'a' }), expense({ id: 'e2', amount: 700, paidById: null })]
    )
    assert.equal(totalSettled, 500)
  })

  it('handles an empty group without throwing', () => {
    const result = settleExpenses([], [])
    assert.deepEqual(result.balances, [])
    assert.deepEqual(result.transfers, [])
    assert.equal(result.totalSettled, 0)
  })
})
