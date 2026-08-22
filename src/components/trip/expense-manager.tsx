'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/budget'
import { addExpense, deleteExpense } from '@/server/actions/expenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExpenseSplitter, SplitPicker } from './expense-splitter'
import { Receipt } from 'lucide-react'
import type { Category } from '@/lib/budget'
import type { ExpenseDTO, TripMemberDTO } from '@/server/queries/types'

const CATEGORIES: Category[] = ['TRANSPORT', 'STAY', 'ACTIVITY', 'MEAL', 'OTHER']

export function ExpenseManager({
  tripId,
  currency,
  expenses,
  stopOptions,
  members = [],
}: {
  tripId: string
  currency: string
  expenses: ExpenseDTO[]
  stopOptions: { id: string; label: string }[]
  members?: TripMemberDTO[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'expenses' | 'group'>('expenses')
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('OTHER')
  const [stopId, setStopId] = useState('')
  const [paidById, setPaidById] = useState('')
  const [sharedWith, setSharedWith] = useState<string[]>([])
  const [splitMode, setSplitMode] = useState<'equal' | 'unequal'>('equal')
  const [customShares, setCustomShares] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const memberById = new Map(members.map((m) => [m.id, m]))

  function resetForm() {
    setLabel('')
    setAmount('')
    setPaidById('')
    setSharedWith([])
    setSplitMode('equal')
    setCustomShares({})
  }

  /** Equal mode leaves splits empty — the engine already shares evenly across the group. */
  function buildSplits(total: number) {
    if (!paidById || sharedWith.length === 0) return undefined
    if (splitMode === 'equal') {
      const share = total / sharedWith.length
      return sharedWith.map((memberId) => ({ memberId, amount: share }))
    }
    return sharedWith.map((memberId) => ({
      memberId,
      amount: Number(customShares[memberId]) || 0,
    }))
  }

  function submit() {
    if (!label.trim() || !amount) return
    const total = Number(amount)
    startTransition(async () => {
      const result = await addExpense({
        tripId,
        category,
        label,
        amount: total,
        stopId: stopId || undefined,
        paidById: paidById || undefined,
        splits: buildSplits(total),
      })
      if (result.ok) {
        toast.success('Expense added')
        resetForm()
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteExpense(id)
      if (result.ok) {
        toast.success('Expense deleted')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div>
      {members.length > 0 || tab === 'group' ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'expenses' | 'group')}>
          <TabsList className="mb-3">
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="group">Group &amp; Splitting</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {tab === 'group' ? (
        <ExpenseSplitter tripId={tripId} currency={currency} members={members} expenses={expenses} />
      ) : (
      <>
      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" description="Add flights, stays or anything else you're tracking." />
      ) : (
        <ul className="divide-y divide-[var(--rule)]">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="mono">{e.category}</Badge>
                <span className="truncate text-sm text-[var(--ink)]">{e.label}</span>
                {e.paidById && memberById.has(e.paidById) && (
                  <span className="shrink-0 text-[11px] text-[var(--muted)]">
                    paid by {memberById.get(e.paidById)!.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-sm font-medium text-[var(--ink)]">{formatMoney(e.amount, currency)}</span>
                <button onClick={() => remove(e.id)} className="text-[var(--muted)] hover:text-red-600" aria-label="Delete expense">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-32">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={stopId} onChange={(e) => setStopId(e.target.value)} className="w-40">
            <option value="">No specific stop</option>
            {stopOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="w-40" />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0} placeholder="Amount" className="w-28" />

          <div className="w-full">
            <SplitPicker
              members={members}
              paidById={paidById}
              onPaidByChange={setPaidById}
              sharedWith={sharedWith}
              onSharedWithChange={setSharedWith}
              mode={splitMode}
              onModeChange={setSplitMode}
              customShares={customShares}
              onCustomShareChange={(memberId, value) =>
                setCustomShares((prev) => ({ ...prev, [memberId]: value }))
              }
              amount={Number(amount) || 0}
              currency={currency}
            />
          </div>

          <Button size="sm" loading={pending} onClick={submit}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { resetForm(); setOpen(false) }}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add expense
          </Button>
          {members.length === 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTab('group')}>
              <Users className="size-4" /> Split with a group
            </Button>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}
