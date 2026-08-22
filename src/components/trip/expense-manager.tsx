'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/budget'
import { addExpense, deleteExpense } from '@/server/actions/expenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Receipt } from 'lucide-react'
import type { Category } from '@/lib/budget'
import type { ExpenseDTO } from '@/server/queries/types'

const CATEGORIES: Category[] = ['TRANSPORT', 'STAY', 'ACTIVITY', 'MEAL', 'OTHER']

export function ExpenseManager({
  tripId,
  currency,
  expenses,
  stopOptions,
}: {
  tripId: string
  currency: string
  expenses: ExpenseDTO[]
  stopOptions: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('OTHER')
  const [stopId, setStopId] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!label.trim() || !amount) return
    startTransition(async () => {
      const result = await addExpense({
        tripId,
        category,
        label,
        amount: Number(amount),
        stopId: stopId || undefined,
      })
      if (result.ok) {
        toast.success('Expense added')
        setLabel('')
        setAmount('')
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
      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" description="Add flights, stays or anything else you're tracking." />
      ) : (
        <ul className="divide-y divide-[var(--rule)]">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="mono">{e.category}</Badge>
                <span className="text-sm text-[var(--ink)]">{e.label}</span>
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
          <Button size="sm" loading={pending} onClick={submit}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add expense
        </Button>
      )}
    </div>
  )
}
