/**
 * Group expense settlement: who owes whom, in as few transfers as possible.
 *
 * Pure and dependency-free so it can be unit-tested and reused on either side of the wire.
 * Money is handled in minor units internally (paise/cents) because repeated fractional
 * splitting in floating point drifts, and a settlement that does not sum to zero is a bug
 * the user sees.
 */

export interface SettlementMember {
  id: string
  name: string
}

export interface ExpenseSplit {
  memberId: string
  /** Share of the expense this member is responsible for, in major units. */
  amount: number
}

export interface SettlementExpense {
  id: string
  amount: number
  /** Null when nobody has been recorded as paying — the expense is then ignored. */
  paidById: string | null
  /** Empty means "split equally between every member". */
  splits: ExpenseSplit[]
}

export interface MemberBalance {
  memberId: string
  name: string
  /** Total this member actually paid out. */
  paid: number
  /** Total this member is responsible for. */
  owed: number
  /** paid − owed. Positive = owed money back, negative = owes money. */
  net: number
}

export interface Transfer {
  from: string
  fromId: string
  to: string
  toId: string
  amount: number
  currency: string
}

export interface Settlement {
  balances: MemberBalance[]
  transfers: Transfer[]
  /** Sum of every expense that had a payer, i.e. what the settlement actually covers. */
  totalSettled: number
  currency: string
}

/** Sub-unit noise below this is rounding, not debt, and must not become a ₹0 transfer. */
const EPSILON_MINOR = 1

function toMinor(amount: number): number {
  return Math.round(amount * 100)
}

function toMajor(minor: number): number {
  return minor / 100
}

/**
 * Splits `total` between `count` people so the parts always sum back to `total` exactly —
 * the remainder is spread one minor unit at a time rather than left on the last person.
 */
function splitEvenly(totalMinor: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.trunc(totalMinor / count)
  const remainder = totalMinor - base * count
  const sign = remainder < 0 ? -1 : 1

  return Array.from({ length: count }, (_, i) => base + (i < Math.abs(remainder) ? sign : 0))
}

/**
 * Net balance per member. An expense with explicit splits uses them; one without is shared
 * equally across all members, which is what the UI's "Equal" mode means.
 */
export function computeBalances(
  members: SettlementMember[],
  expenses: SettlementExpense[]
): MemberBalance[] {
  const paid = new Map<string, number>()
  const owed = new Map<string, number>()
  const known = new Set(members.map((m) => m.id))
  for (const member of members) {
    paid.set(member.id, 0)
    owed.set(member.id, 0)
  }

  for (const expense of expenses) {
    // No payer means nothing was actually settled between the group.
    if (!expense.paidById || !known.has(expense.paidById)) continue

    const totalMinor = toMinor(expense.amount)
    if (totalMinor === 0) continue

    paid.set(expense.paidById, (paid.get(expense.paidById) ?? 0) + totalMinor)

    const explicit = expense.splits.filter((s) => known.has(s.memberId))
    if (explicit.length === 0) {
      const shares = splitEvenly(totalMinor, members.length)
      members.forEach((m, i) => owed.set(m.id, (owed.get(m.id) ?? 0) + shares[i]))
      continue
    }

    // Explicit shares may not add up (rounding, or a half-finished unequal split), so they
    // are scaled onto the real total — otherwise the balances would never net to zero.
    const declaredMinor = explicit.reduce((sum, s) => sum + toMinor(s.amount), 0)
    if (declaredMinor === 0) {
      const shares = splitEvenly(totalMinor, explicit.length)
      explicit.forEach((s, i) => owed.set(s.memberId, (owed.get(s.memberId) ?? 0) + shares[i]))
      continue
    }

    let assigned = 0
    explicit.forEach((split, i) => {
      const isLast = i === explicit.length - 1
      // The last share absorbs the rounding drift so the parts sum to the total exactly.
      const shareMinor = isLast
        ? totalMinor - assigned
        : Math.round((toMinor(split.amount) / declaredMinor) * totalMinor)
      assigned += shareMinor
      owed.set(split.memberId, (owed.get(split.memberId) ?? 0) + shareMinor)
    })
  }

  return members.map((member) => {
    const paidMinor = paid.get(member.id) ?? 0
    const owedMinor = owed.get(member.id) ?? 0
    return {
      memberId: member.id,
      name: member.name,
      paid: toMajor(paidMinor),
      owed: toMajor(owedMinor),
      net: toMajor(paidMinor - owedMinor),
    }
  })
}

/**
 * Greedy largest-debtor-to-largest-creditor matching. Each step fully settles at least one
 * person, so it never needs more than (people − 1) transfers, and in practice it produces the
 * minimum for the balance shapes a trip actually produces.
 */
export function minimalTransfers(balances: MemberBalance[], currency = 'INR'): Transfer[] {
  const nameById = new Map(balances.map((b) => [b.memberId, b.name]))

  const debtors = balances
    .filter((b) => toMinor(b.net) < -EPSILON_MINOR)
    .map((b) => ({ id: b.memberId, minor: -toMinor(b.net) }))
  const creditors = balances
    .filter((b) => toMinor(b.net) > EPSILON_MINOR)
    .map((b) => ({ id: b.memberId, minor: toMinor(b.net) }))

  // Largest first: settling the biggest pair first zeroes people out fastest.
  debtors.sort((a, b) => b.minor - a.minor)
  creditors.sort((a, b) => b.minor - a.minor)

  const transfers: Transfer[] = []
  let d = 0
  let c = 0

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]
    const creditor = creditors[c]
    const amountMinor = Math.min(debtor.minor, creditor.minor)

    if (amountMinor > EPSILON_MINOR) {
      transfers.push({
        from: nameById.get(debtor.id) ?? 'Unknown',
        fromId: debtor.id,
        to: nameById.get(creditor.id) ?? 'Unknown',
        toId: creditor.id,
        amount: toMajor(amountMinor),
        currency,
      })
    }

    debtor.minor -= amountMinor
    creditor.minor -= amountMinor
    if (debtor.minor <= EPSILON_MINOR) d++
    if (creditor.minor <= EPSILON_MINOR) c++
  }

  return transfers
}

export function settleExpenses(
  members: SettlementMember[],
  expenses: SettlementExpense[],
  currency = 'INR'
): Settlement {
  const balances = computeBalances(members, expenses)
  const known = new Set(members.map((m) => m.id))

  return {
    balances,
    transfers: minimalTransfers(balances, currency),
    totalSettled: expenses
      .filter((e) => e.paidById && known.has(e.paidById))
      .reduce((sum, e) => sum + e.amount, 0),
    currency,
  }
}
