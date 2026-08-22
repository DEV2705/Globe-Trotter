'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { addExpense } from '@/server/actions/expenses'
import type { Category } from '@/lib/budget'

const CATEGORY_OPTIONS: Category[] = ['TRANSPORT', 'STAY', 'MEAL', 'OTHER']

export function ExpenseQuickAdd({ tripId, stopId, onAdded }: { tripId: string; stopId: string; onAdded?: () => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('OTHER')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!label.trim() || !amount) return
    startTransition(async () => {
      const result = await addExpense({ tripId, stopId, category, label, amount: Number(amount) })
      if (result.ok) {
        toast.success('Expense added')
        setLabel('')
        setAmount('')
        setOpen(false)
        onAdded?.()
      } else {
        toast.error(result.error)
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-[var(--stamp)] hover:underline"
      >
        <Plus className="size-3.5" /> Add expense
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-32">
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
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
  )
}
