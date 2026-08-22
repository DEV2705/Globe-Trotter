'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/budget'
import { moveActivityToDay } from '@/server/actions/activities'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { BudgetSummary } from '@/lib/budget'
import type { StopDTO, TripActivityDTO, TripFullDTO } from '@/server/queries/types'

const TYPE_COLORS: Record<string, string> = {
  SIGHTSEEING: '#1F4B3F',
  FOOD: '#C9A227',
  ADVENTURE: '#E0642B',
  CULTURE: '#3E7C6A',
  NATURE: '#2E7D32',
  NIGHTLIFE: '#7C3AED',
  RELAX: '#0EA5E9',
  SHOPPING: '#DB2777',
}

function ActivityChip({ item }: { item: TripActivityDTO }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('mb-1 flex w-full items-center gap-1.5 truncate rounded px-1.5 py-1 text-left text-[11px] text-white', isDragging && 'opacity-50')}
      style={{ background: TYPE_COLORS[item.activity.type] ?? '#6B7280' }}
      title={item.activity.name}
    >
      <span className="truncate">{item.activity.name}</span>
    </button>
  )
}

function DayCell({
  dayIndex,
  date,
  items,
  isToday,
  overCap,
  onOpen,
}: {
  dayIndex: number
  date: string
  items: TripActivityDTO[]
  isToday: boolean
  overCap: boolean
  onOpen: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayIndex}` })
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={cn(
        'min-h-24 cursor-pointer rounded-md border p-1.5',
        isOver ? 'border-[var(--stamp)] bg-[var(--stamp-50)]' : 'border-[var(--rule)]',
        overCap && 'border-[var(--transit)]'
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={cn('num text-xs', isToday ? 'font-bold text-[var(--stamp)]' : 'text-[var(--muted)]')}>
          {formatDay(new Date(date), 'd MMM')}
        </span>
        {overCap && <span className="size-1.5 rounded-full bg-[var(--transit)]" />}
      </div>
      {items.map((item) => (
        <ActivityChip key={item.id} item={item} />
      ))}
    </div>
  )
}

export function CalendarClient({ trip, budget }: { trip: TripFullDTO; budget: BudgetSummary }) {
  const [items, setItems] = useState<(TripActivityDTO & { stop: StopDTO })[]>(
    trip.stops.flatMap((s) => s.items.map((i) => ({ ...i, stop: s })))
  )
  const [openDay, setOpenDay] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const todayStr = new Date().toISOString().slice(0, 10)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const targetDay = Number(String(over.id).replace('day-', ''))
    const item = items.find((i) => i.id === active.id)
    if (!item || item.dayIndex === targetDay) return

    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, dayIndex: targetDay } : i)))
    moveActivityToDay(item.id, targetDay).then((r) => {
      if (!r.ok) toast.error(r.error)
    })
  }

  const weeks: number[][] = []
  for (let i = 0; i < trip.dayDates.length; i += 7) {
    weeks.push(Array.from({ length: Math.min(7, trip.dayDates.length - i) }, (_, j) => i + j))
  }

  const dayItems = (dayIndex: number) => items.filter((i) => i.dayIndex === dayIndex).sort((a, b) => a.order - b.order)

  return (
    <div>
      {/* Month-grid view (sm and up) */}
      <div className="hidden sm:block">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-2">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
                {week.map((dayIndex) => (
                  <DayCell
                    key={dayIndex}
                    dayIndex={dayIndex}
                    date={trip.dayDates[dayIndex]}
                    items={dayItems(dayIndex)}
                    isToday={trip.dayDates[dayIndex] === todayStr}
                    overCap={budget.byDay[dayIndex]?.overCap ?? false}
                    onOpen={() => setOpenDay(dayIndex)}
                  />
                ))}
              </div>
            ))}
          </div>
        </DndContext>
      </div>

      {/* Vertical timeline fallback (narrow screens) */}
      <div className="flex flex-col gap-2 sm:hidden">
        {trip.dayDates.map((date, dayIndex) => (
          <button
            key={dayIndex}
            onClick={() => setOpenDay(dayIndex)}
            className={cn(
              'rounded-md border p-2.5 text-left',
              budget.byDay[dayIndex]?.overCap ? 'border-[var(--transit)]' : 'border-[var(--rule)]'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="num text-sm font-medium text-[var(--ink)]">Day {dayIndex + 1} · {formatDay(new Date(date))}</span>
              <span className="num text-xs text-[var(--muted)]">{dayItems(dayIndex).length} activities</span>
            </div>
          </button>
        ))}
      </div>

      <Sheet open={openDay !== null} onOpenChange={(o) => !o && setOpenDay(null)}>
        <SheetContent>
          {openDay !== null && (
            <>
              <SheetTitle>Day {openDay + 1} · {formatDay(new Date(trip.dayDates[openDay]))}</SheetTitle>
              <div className="mt-4 flex flex-col gap-2">
                {dayItems(openDay).length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Nothing planned yet.</p>
                ) : (
                  dayItems(openDay).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--rule)] p-2.5">
                      <div>
                        <p className="text-sm font-medium text-[var(--ink)]">{item.activity.name}</p>
                        <p className="text-xs text-[var(--muted)]">{item.startTime ?? '--:--'} · {item.stop.city.name}</p>
                      </div>
                      <span className="num text-sm text-[var(--ink)]">{formatMoney(item.cost, trip.currency)}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
