'use client'

import { useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/budget'
import { updateTripActivity, removeTripActivity } from '@/server/actions/activities'
import type { TripActivityDTO } from '@/server/queries/types'

export function ActivityRow({
  item,
  dayLabel,
  onCostChange,
  onRemove,
}: {
  item: TripActivityDTO
  dayLabel: string
  onCostChange: (id: string, cost: number) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [cost, setCost] = useState(String(item.cost))
  const [, startTransition] = useTransition()

  const style = { transform: CSS.Transform.toString(transform), transition }

  function commitCost() {
    const value = Number(cost)
    if (Number.isNaN(value) || value < 0) {
      setCost(String(item.cost))
      return
    }
    onCostChange(item.id, value)
    startTransition(async () => {
      const result = await updateTripActivity({ id: item.id, cost: value })
      if (!result.ok) toast.error(result.error)
    })
  }

  function handleRemove() {
    onRemove(item.id)
    startTransition(async () => {
      const result = await removeTripActivity(item.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border border-[var(--rule)] bg-[var(--surface)] p-2.5',
        isDragging && 'shadow-lg'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-[var(--muted)] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="num w-14 shrink-0 text-xs text-[var(--muted)]">{dayLabel}</span>
      <span className="num w-16 shrink-0 text-xs text-[var(--muted)]">{item.startTime ?? '--:--'}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--ink)]">{item.activity.name}</p>
        <p className="num text-xs text-[var(--muted)]">{formatDuration(item.activity.durationMin)}</p>
      </div>
      <div className="flex items-center gap-1">
        <span className="num text-xs text-[var(--muted)]">₹</span>
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onBlur={commitCost}
          type="number"
          min={0}
          className="num w-20 rounded border border-[var(--rule)] px-1.5 py-1 text-sm"
          aria-label="Cost"
        />
      </div>
      <button onClick={handleRemove} className="rounded p-1 text-[var(--muted)] hover:bg-red-50 hover:text-red-600" aria-label="Remove activity">
        <X className="size-4" />
      </button>
    </div>
  )
}
