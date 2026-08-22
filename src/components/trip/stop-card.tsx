'use client'

import { useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/budget'
import { updateStop, deleteStop } from '@/server/actions/stops'
import { reorderActivities } from '@/server/actions/activities'
import { ActivityRow } from './activity-row'
import { ExpenseQuickAdd } from './expense-quick-add'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import type { StopDTO, TripActivityDTO } from '@/server/queries/types'

export function StopCard({
  stop,
  index,
  tripId,
  dayDates,
  onAddActivity,
  onItemsChange,
  onRemoved,
}: {
  stop: StopDTO
  index: number
  tripId: string
  dayDates: string[]
  onAddActivity: (stop: StopDTO) => void
  onItemsChange: (stopId: string, items: TripActivityDTO[]) => void
  onRemoved: (stopId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const [notes, setNotes] = useState(stop.notes ?? '')
  const [startDate, setStartDate] = useState(stop.startDate)
  const [endDate, setEndDate] = useState(stop.endDate)
  const [dateError, setDateError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const style = { transform: CSS.Transform.toString(transform), transition }
  const total = stop.items.reduce((sum, i) => sum + i.cost, 0)

  function commitMeta() {
    startTransition(async () => {
      const result = await updateStop({ stopId: stop.id, startDate, endDate, notes })
      if (!result.ok) {
        setDateError(result.error)
        setStartDate(stop.startDate)
        setEndDate(stop.endDate)
      } else {
        setDateError(null)
      }
    })
  }

  function handleRemoveStop() {
    startTransition(async () => {
      const result = await deleteStop(stop.id)
      if (result.ok) {
        onRemoved(stop.id)
        toast.success('Stop deleted')
      } else {
        toast.error(result.error)
        setConfirmOpen(false)
      }
    })
  }

  function handleCostChange(itemId: string, cost: number) {
    onItemsChange(
      stop.id,
      stop.items.map((i) => (i.id === itemId ? { ...i, cost } : i))
    )
  }

  function handleRemoveItem(itemId: string) {
    onItemsChange(
      stop.id,
      stop.items.filter((i) => i.id !== itemId)
    )
  }

  function handleActivityDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stop.items.findIndex((i) => i.id === active.id)
    const newIndex = stop.items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(stop.items, oldIndex, newIndex)
    onItemsChange(stop.id, reordered)

    const byDay = new Map<number, string[]>()
    for (const item of reordered) {
      const arr = byDay.get(item.dayIndex) ?? []
      arr.push(item.id)
      byDay.set(item.dayIndex, arr)
    }
    for (const [dayIndex, order] of byDay) {
      reorderActivities({ stopId: stop.id, dayIndex, order }).then((r) => {
        if (!r.ok) toast.error(r.error)
      })
    }
  }

  const sortedItems = [...stop.items].sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('perf-edge rounded-lg border border-[var(--rule)] bg-[var(--surface)]', isDragging && 'shadow-lg')}
    >
      <div className="perf-edge-strip" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <button
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab touch-none text-[var(--muted)] active:cursor-grabbing"
              aria-label="Drag to reorder section"
            >
              <GripVertical className="size-4" />
            </button>
            <div>
              <h3 className="display text-base text-[var(--ink)]">
                Section {index + 1}: {stop.city.name}
              </h3>
              <p className="text-xs text-[var(--muted)]">{stop.city.country}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--muted)]">Budget of this section</p>
            <p className="num text-lg font-medium text-[var(--ink)]">{formatMoney(total)}</p>
          </div>
        </div>

        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitMeta}
          placeholder="All the necessary information about this section. This can be anything like travel section, hotel or any other activity"
          rows={2}
          className="mt-3"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">Date Range:</span>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onBlur={commitMeta} className="w-40" />
          <span className="text-[var(--muted)]">to</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onBlur={commitMeta} className="w-40" />
        </div>
        {dateError && <p className="mt-1 text-xs text-red-600">{dateError}</p>}

        <div className="mt-4 flex flex-col gap-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActivityDragEnd}>
            <SortableContext items={sortedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {sortedItems.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  dayLabel={`Day ${item.dayIndex + 1}`}
                  onCostChange={handleCostChange}
                  onRemove={handleRemoveItem}
                />
              ))}
            </SortableContext>
          </DndContext>
          {sortedItems.length === 0 && (
            <p className="rounded-md border border-dashed border-[var(--rule)] p-3 text-center text-xs text-[var(--muted)]">
              No activities yet.
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => onAddActivity(stop)}>
            Add activity
          </Button>
          <ExpenseQuickAdd tripId={tripId} stopId={stop.id} />
        </div>

        <div className="mt-3 flex justify-end border-t border-[var(--rule)] pt-3">
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
          >
            <Trash2 className="size-3.5" /> Remove section
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this section?"
        description={`${stop.city.name} and its activities will be removed from this trip.`}
        loading={pending}
        onConfirm={handleRemoveStop}
      />
    </div>
  )
}
