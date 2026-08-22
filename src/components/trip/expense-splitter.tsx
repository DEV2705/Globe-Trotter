'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Trash2, UserPlus, Users, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/budget'
import { settleExpenses } from '@/lib/debt-settlement'
import { addTripMember, removeTripMember } from '@/server/actions/members'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { ExpenseDTO, TripMemberDTO } from '@/server/queries/types'

export function ExpenseSplitter({
  tripId,
  currency,
  members,
  expenses,
}: {
  tripId: string
  currency: string
  members: TripMemberDTO[]
  expenses: ExpenseDTO[]
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()

  const settlement = useMemo(
    () =>
      settleExpenses(
        members.map((m) => ({ id: m.id, name: m.name })),
        expenses.map((e) => ({
          id: e.id,
          amount: e.amount,
          paidById: e.paidById,
          splits: e.splits,
        })),
        currency
      ),
    [members, expenses, currency]
  )

  const unassigned = expenses.filter((e) => !e.paidById)

  function addMember() {
    const trimmed = name.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await addTripMember({ tripId, name: trimmed })
      if (result.ok) {
        setName('')
        toast.success(`${trimmed} added to the group`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function remove(member: TripMemberDTO) {
    startTransition(async () => {
      const result = await removeTripMember(member.id)
      if (result.ok) {
        toast.success(`${member.name} removed`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Users className="size-3.5" /> Travellers
        </h4>

        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addMember()
              }
            }}
            placeholder="Add a traveller..."
            aria-label="Traveller name"
          />
          <Button size="sm" onClick={addMember} loading={pending} disabled={!name.trim()}>
            <UserPlus className="size-3.5" /> Add
          </Button>
        </div>

        {members.length > 0 && (
          <ul className="mt-2 flex flex-col divide-y divide-[var(--rule)]">
            {members.map((member) => {
              const balance = settlement.balances.find((b) => b.memberId === member.id)
              return (
                <li key={member.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">{member.name}</p>
                    <p className="num text-[11px] text-[var(--muted)]">
                      paid {formatMoney(balance?.paid ?? 0, currency)} · owes{' '}
                      {formatMoney(balance?.owed ?? 0, currency)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <NetPill net={balance?.net ?? 0} currency={currency} />
                    <button
                      type="button"
                      onClick={() => remove(member)}
                      disabled={pending}
                      aria-label={`Remove ${member.name}`}
                      className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--stamp-50)] hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No travellers yet"
          description="Add everyone sharing the costs, then record who paid for each expense."
        />
      ) : (
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <Wallet className="size-3.5" /> Settlement
          </h4>

          <div className="rounded-md border border-[var(--rule)] bg-[var(--paper)] p-3">
            <p className="num text-sm text-[var(--ink)]">
              {formatMoney(settlement.totalSettled, currency)}
              <span className="ml-1 text-xs text-[var(--muted)]">shared across {members.length} travellers</span>
            </p>

            {settlement.transfers.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {settlement.totalSettled === 0
                  ? 'No shared expenses yet — set who paid on an expense to start splitting.'
                  : 'All square. Nobody owes anybody.'}
              </p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {settlement.transfers.map((transfer, i) => (
                  <li
                    key={`${transfer.fromId}-${transfer.toId}`}
                    className="flex items-center gap-2 rounded-md border border-[var(--rule)] bg-[var(--surface)] p-2.5 text-sm"
                  >
                    <span className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--stamp-50)] text-[10px] font-semibold text-[var(--stamp-700)]">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-[var(--ink)]">{transfer.from}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-[var(--muted)]" />
                    <span className="truncate font-medium text-[var(--ink)]">{transfer.to}</span>
                    <span className="num ml-auto shrink-0 font-medium text-[var(--stamp-700)]">
                      {formatMoney(transfer.amount, currency)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {unassigned.length > 0 && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {unassigned.length} expense{unassigned.length === 1 ? '' : 's'} ha
              {unassigned.length === 1 ? 's' : 've'} no payer set, so {unassigned.length === 1 ? 'it is' : 'they are'}{' '}
              budgeted but not split.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

/** `+₹1,500` green when owed money back, `-₹2,100` red when owing. */
function NetPill({ net, currency }: { net: number; currency: string }) {
  const rounded = Math.abs(net) < 0.01 ? 0 : net
  if (rounded === 0) return <Badge variant="neutral">settled</Badge>

  return (
    <span
      className={cn(
        'num rounded-full px-2 py-0.5 text-xs font-semibold',
        rounded > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
      )}
    >
      {rounded > 0 ? '+' : '−'}
      {formatMoney(Math.abs(rounded), currency)}
    </span>
  )
}

/** Payer + share pickers embedded in the expense form. */
export function SplitPicker({
  members,
  paidById,
  onPaidByChange,
  sharedWith,
  onSharedWithChange,
  mode,
  onModeChange,
  customShares,
  onCustomShareChange,
  amount,
  currency,
}: {
  members: TripMemberDTO[]
  paidById: string
  onPaidByChange: (id: string) => void
  sharedWith: string[]
  onSharedWithChange: (ids: string[]) => void
  mode: 'equal' | 'unequal'
  onModeChange: (mode: 'equal' | 'unequal') => void
  customShares: Record<string, string>
  onCustomShareChange: (memberId: string, value: string) => void
  amount: number
  currency: string
}) {
  if (members.length === 0) return null

  const equalShare = sharedWith.length > 0 ? amount / sharedWith.length : 0
  const declared = sharedWith.reduce((sum, id) => sum + (Number(customShares[id]) || 0), 0)

  function toggleShare(id: string) {
    onSharedWithChange(sharedWith.includes(id) ? sharedWith.filter((s) => s !== id) : [...sharedWith, id])
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--rule)] bg-[var(--paper)] p-2.5">
      <label className="text-xs font-medium text-[var(--ink)]" htmlFor="paid-by">
        Paid by
      </label>
      <div className="flex flex-wrap gap-1.5">
        <ChipButton active={paidById === ''} onClick={() => onPaidByChange('')}>
          Nobody / not shared
        </ChipButton>
        {members.map((m) => (
          <ChipButton key={m.id} active={paidById === m.id} onClick={() => onPaidByChange(m.id)}>
            {m.name}
          </ChipButton>
        ))}
      </div>

      {paidById && (
        <>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--ink)]">Split between</span>
            <div className="flex gap-1">
              <ChipButton active={mode === 'equal'} onClick={() => onModeChange('equal')}>
                Equal
              </ChipButton>
              <ChipButton active={mode === 'unequal'} onClick={() => onModeChange('unequal')}>
                Unequal
              </ChipButton>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {members.map((m) => {
              const included = sharedWith.includes(m.id)
              return (
                <div key={m.id} className="flex items-center gap-2">
                  <label className="flex flex-1 items-center gap-2 text-sm text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleShare(m.id)}
                      className="size-3.5 accent-[var(--stamp)]"
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                  {included &&
                    (mode === 'equal' ? (
                      <span className="num shrink-0 text-xs text-[var(--muted)]">
                        {formatMoney(equalShare, currency)}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={customShares[m.id] ?? ''}
                        onChange={(e) => onCustomShareChange(m.id, e.target.value)}
                        aria-label={`${m.name}'s share`}
                        className="h-8 w-24 shrink-0 text-xs"
                      />
                    ))}
                </div>
              )
            })}
          </div>

          {mode === 'unequal' && Math.abs(declared - amount) > 0.5 && amount > 0 && (
            <p className="text-[11px] text-[var(--transit)]">
              Shares total {formatMoney(declared, currency)} of {formatMoney(amount, currency)} — they will be
              scaled to match.
            </p>
          )}
          {sharedWith.length === 0 && (
            <p className="text-[11px] text-[var(--transit)]">
              Nobody selected — this will be split equally across everyone.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--stamp)] bg-[var(--stamp-50)] text-[var(--stamp-700)]'
          : 'border-[var(--rule)] text-[var(--muted)] hover:bg-[var(--stamp-50)]'
      )}
    >
      {children}
    </button>
  )
}
