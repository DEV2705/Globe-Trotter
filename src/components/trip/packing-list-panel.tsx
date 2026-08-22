'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Backpack, Plus, RefreshCw, Trash2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  generateTripPackingList,
  togglePackingItem,
  deletePackingItem,
  addPackingItem,
} from '@/server/actions/packing'

export interface PackingItemView {
  id: string
  category: string
  label: string
  qty: number
  packed: boolean
  note: string | null
}

const CATEGORIES = ['Documents', 'Clothing', 'Electronics', 'Health', 'Gear'] as const

export function PackingListPanel({
  tripId,
  items,
  aiEnabled,
}: {
  tripId: string
  items: PackingItemView[]
  aiEnabled: boolean
}) {
  const router = useRouter()
  const [generating, startGenerating] = useTransition()
  const [adding, startAdding] = useTransition()
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState<string>('Gear')
  // Checkboxes respond immediately; the server action reconciles behind them.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})

  const packedOf = (item: PackingItemView) => optimistic[item.id] ?? item.packed
  const packedCount = items.filter(packedOf).length

  function generate() {
    startGenerating(async () => {
      const result = await generateTripPackingList(tripId)
      if (result.ok) {
        setOptimistic({})
        toast.success('Packing list ready')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function toggle(item: PackingItemView) {
    const next = !packedOf(item)
    setOptimistic((prev) => ({ ...prev, [item.id]: next }))
    void togglePackingItem(item.id).then((result) => {
      if (!result.ok) {
        setOptimistic((prev) => ({ ...prev, [item.id]: !next }))
        toast.error(result.error)
      }
    })
  }

  function remove(item: PackingItemView) {
    void deletePackingItem(item.id).then((result) => {
      if (result.ok) router.refresh()
      else toast.error(result.error)
    })
  }

  function add() {
    const label = newLabel.trim()
    if (!label) return
    startAdding(async () => {
      const result = await addPackingItem(tripId, label, newCategory)
      if (result.ok) {
        setNewLabel('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const grouped = CATEGORIES.map((category) => ({
    category,
    entries: items.filter((i) => i.category === category),
  })).filter((group) => group.entries.length > 0)

  if (items.length === 0) {
    return (
      <Panel title="Packing list" description="A checklist built around where you are going and what you will be doing.">
        <div className="py-4 text-center">
          <Backpack className="mx-auto mb-2 size-6 text-[var(--muted)]" />
          {aiEnabled ? (
            <>
              <p className="text-sm text-[var(--muted)]">No packing list yet.</p>
              <Button className="mt-3" size="sm" loading={generating} onClick={generate}>
                <Sparkles className="size-4" /> Generate packing list
              </Button>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Packing list generation is not configured on this server.</p>
          )}
        </div>
      </Panel>
    )
  }

  const progress = Math.round((packedCount / items.length) * 100)

  return (
    <Panel
      title="Packing list"
      description={`${packedCount} of ${items.length} packed`}
      action={
        aiEnabled ? (
          <Button variant="ghost" size="sm" loading={generating} onClick={generate} title="Replaces the current list">
            <RefreshCw className="size-4" /> Regenerate
          </Button>
        ) : undefined
      }
    >
      <div
        className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--rule)]"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Packing progress"
      >
        <div className="h-full rounded-full bg-[var(--stamp)] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex flex-col gap-4">
        {grouped.map((group) => (
          <div key={group.category}>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {group.category}
            </h4>
            <ul className="flex flex-col gap-1">
              {group.entries.map((item) => {
                const packed = packedOf(item)
                return (
                  <li key={item.id} className="group flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id={`pack-${item.id}`}
                      checked={packed}
                      onChange={() => toggle(item)}
                      className="size-4 shrink-0 accent-[var(--stamp)]"
                    />
                    <label
                      htmlFor={`pack-${item.id}`}
                      className={cn(
                        'flex-1 cursor-pointer text-sm',
                        packed ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'
                      )}
                    >
                      {item.label}
                      {item.qty > 1 && <span className="num text-[var(--muted)]"> ×{item.qty}</span>}
                      {item.note && <span className="block text-xs text-[var(--muted)]">{item.note}</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label={`Remove ${item.label}`}
                      className="no-print shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="no-print mt-4 flex items-center gap-2 border-t border-[var(--rule)] pt-3">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add your own item"
          className="flex-1"
        />
        <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-auto">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="outline" loading={adding} onClick={add} disabled={!newLabel.trim()}>
          <Plus className="size-4" />
        </Button>
      </div>
    </Panel>
  )
}
