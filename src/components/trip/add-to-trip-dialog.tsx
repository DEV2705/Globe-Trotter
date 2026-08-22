'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { addStop } from '@/server/actions/stops'
import { addActivityFromExplore } from '@/server/actions/activities'
import type { TripOption } from '@/server/queries/types'

export function AddToTripDialog({
  open,
  onOpenChange,
  tripOptions,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripOptions: TripOption[]
  target: { kind: 'city'; cityId: string } | { kind: 'activity'; activityId: string; cityId: string } | null
}) {
  const [tripId, setTripId] = useState(tripOptions[0]?.id ?? '')
  const [stopId, setStopId] = useState('')
  const [dayIndex, setDayIndex] = useState(0)
  const [pending, startTransition] = useTransition()

  const selectedTrip = tripOptions.find((t) => t.id === tripId)
  const matchingStops = useMemo(
    () => (target ? selectedTrip?.stops.filter(() => true) ?? [] : []),
    [selectedTrip, target]
  )
  const dayOptions = useMemo(() => {
    const stop = matchingStops.find((s) => s.id === stopId)
    if (!stop) return []
    const opts = []
    for (let d = stop.startDayIndex; d <= stop.endDayIndex; d++) opts.push(d)
    return opts
  }, [matchingStops, stopId])

  if (!target) return null

  function submit() {
    if (!tripId) return
    startTransition(async () => {
      if (target!.kind === 'city') {
        const trip = tripOptions.find((t) => t.id === tripId)
        if (!trip) return
        const lastStop = [...trip.stops].sort((a, b) => a.endDayIndex - b.endDayIndex).at(-1)
        const startDate = lastStop ? trip.endDate : trip.startDate
        const result = await addStop({
          tripId,
          cityId: target!.cityId,
          startDate,
          endDate: trip.endDate,
        })
        if (result.ok) {
          toast.success('Stop added')
          onOpenChange(false)
        } else {
          toast.error(result.error)
        }
        return
      }

      if (!stopId) {
        toast.error('Pick a stop in that trip first.')
        return
      }
      const result = await addActivityFromExplore(target!.activityId, stopId, dayIndex)
      if (result.ok) {
        toast.success('Activity added')
        onOpenChange(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Trip</DialogTitle>
        </DialogHeader>

        {tripOptions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Create a trip first, then come back here.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Select value={tripId} onChange={(e) => { setTripId(e.target.value); setStopId('') }}>
              {tripOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>

            {target.kind === 'activity' && (
              <>
                <Select value={stopId} onChange={(e) => setStopId(e.target.value)}>
                  <option value="">Select a stop...</option>
                  {matchingStops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.cityName}
                    </option>
                  ))}
                </Select>
                {dayOptions.length > 0 && (
                  <Select value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))}>
                    {dayOptions.map((d) => (
                      <option key={d} value={d}>
                        Day {d + 1}
                      </option>
                    ))}
                  </Select>
                )}
              </>
            )}

            <Button loading={pending} onClick={submit} className="self-end">
              Add
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
