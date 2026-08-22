'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Luggage } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { addStop, reorderStops } from '@/server/actions/stops'
import { addActivityToStop } from '@/server/actions/activities'
import { StopCard } from './stop-card'
import { CityPickerDialog } from './city-picker-dialog'
import { ActivityPickerDialog } from './activity-picker-dialog'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMoney } from '@/lib/budget'
import type { CityOption } from '@/server/queries/catalog'
import type { ActivityCardDTO, StopDTO, TripActivityDTO, TripFullDTO } from '@/server/queries/types'

export function BuilderClient({
  trip,
  cityOptions,
  activitiesByCity,
}: {
  trip: TripFullDTO
  cityOptions: CityOption[]
  activitiesByCity: Record<string, ActivityCardDTO[]>
}) {
  const router = useRouter()
  const [stops, setStops] = useState<StopDTO[]>(trip.stops)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [activityPickerStop, setActivityPickerStop] = useState<StopDTO | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    setStops(trip.stops)
  }, [trip])

  const tripTotal = stops.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.cost, 0), 0)

  function handleStopsDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stops.findIndex((s) => s.id === active.id)
    const newIndex = stops.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(stops, oldIndex, newIndex)
    setStops(reordered)
    reorderStops({ tripId: trip.id, order: reordered.map((s) => s.id) }).then((r) => {
      if (!r.ok) toast.error(r.error)
    })
  }

  async function handleAddCity(city: CityOption) {
    const last = [...stops].sort((a, b) => a.order - b.order).at(-1)
    const start = last ? last.endDate : trip.startDate
    const end = trip.endDate < start ? start : trip.endDate

    const result = await addStop({ tripId: trip.id, cityId: city.id, startDate: start, endDate: end })
    if (result.ok) {
      toast.success('Section added')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  function handleItemsChange(stopId: string, items: TripActivityDTO[]) {
    setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, items } : s)))
  }

  function handleStopRemoved(stopId: string) {
    setStops((prev) => prev.filter((s) => s.id !== stopId))
  }

  async function handleAddActivity(activityId: string, dayIndex: number, startTime?: string) {
    if (!activityPickerStop) return
    const result = await addActivityToStop({ stopId: activityPickerStop.id, activityId, dayIndex, startTime })
    if (result.ok) {
      toast.success('Activity added')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  const dayOptionsFor = (stop: StopDTO) => {
    const opts: { dayIndex: number; label: string }[] = []
    for (let d = stop.startDayIndex; d <= stop.endDayIndex; d++) opts.push({ dayIndex: d, label: `Day ${d + 1}` })
    return opts
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Trip total so far</p>
        <p className="num text-lg font-medium text-[var(--ink)]">{formatMoney(tripTotal, trip.currency)}</p>
      </div>

      {stops.length === 0 ? (
        <EmptyState
          icon={Luggage}
          title="Add your first stop"
          description="Pick a city to start building your itinerary."
          action={
            <Button onClick={() => setCityPickerOpen(true)}>
              <Plus className="size-4" /> Add a stop
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStopsDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-4">
              {stops
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((stop, index) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    index={index}
                    tripId={trip.id}
                    dayDates={trip.dayDates}
                    onAddActivity={setActivityPickerStop}
                    onItemsChange={handleItemsChange}
                    onRemoved={handleStopRemoved}
                  />
                ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {stops.length > 0 && (
        <Button variant="outline" className="mt-4" onClick={() => setCityPickerOpen(true)}>
          <Plus className="size-4" /> Add another Section
        </Button>
      )}

      <CityPickerDialog
        open={cityPickerOpen}
        onOpenChange={setCityPickerOpen}
        cityOptions={cityOptions}
        onSelect={handleAddCity}
      />

      {activityPickerStop && (
        <ActivityPickerDialog
          open={!!activityPickerStop}
          onOpenChange={(open) => !open && setActivityPickerStop(null)}
          activities={activitiesByCity[activityPickerStop.cityId] ?? []}
          dayOptions={dayOptionsFor(activityPickerStop)}
          onAdd={handleAddActivity}
        />
      )}
    </div>
  )
}
