'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { addStop } from '@/server/actions/stops'
import { addActivityFromExplore } from '@/server/actions/activities'
import { dateForDayIndex, formatRange, parseDateInput, toDateInput, tripLength } from '@/lib/dates'
import type { TripOption } from '@/server/queries/types'

/** Default length for a stop the traveller has not sized yet. */
const DEFAULT_STOP_NIGHTS = 2

interface SuggestedWindow {
  startDate: string
  endDate: string
  /** Why these dates — shown so the suggestion is not a black box. */
  reason: string
  /** No room left in the trip for another stop. */
  full: boolean
}

/**
 * Picks the first free window after the last stop. Stops may meet on a shared handover day
 * (arrive the day you leave), but must not overlap, so the search starts the day after the
 * last stop ends and only falls back to the handover day when that is the last day left.
 */
function suggestWindow(trip: TripOption | undefined): SuggestedWindow | null {
  if (!trip) return null

  const tripStart = parseDateInput(trip.startDate)
  const lastDayIndex = tripLength(tripStart, parseDateInput(trip.endDate)) - 1

  if (trip.stops.length === 0) {
    const end = Math.min(DEFAULT_STOP_NIGHTS, lastDayIndex)
    return {
      startDate: trip.startDate,
      endDate: toDateInput(dateForDayIndex(tripStart, end)),
      reason: 'First stop — starts on day one of the trip.',
      full: false,
    }
  }

  const lastEnd = Math.max(...trip.stops.map((s) => s.endDayIndex))
  if (lastEnd >= lastDayIndex) {
    return {
      startDate: trip.endDate,
      endDate: trip.endDate,
      reason: 'The existing stops already fill this trip — extend its dates to fit another.',
      full: true,
    }
  }

  const start = lastEnd + 1
  const end = Math.min(start + DEFAULT_STOP_NIGHTS, lastDayIndex)
  return {
    startDate: toDateInput(dateForDayIndex(tripStart, start)),
    endDate: toDateInput(dateForDayIndex(tripStart, end)),
    reason: `Starts the day after your last stop ends (day ${start + 1}).`,
    full: false,
  }
}

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
  const router = useRouter()
  const [tripId, setTripId] = useState(tripOptions[0]?.id ?? '')
  const [stopId, setStopId] = useState('')
  const [dayIndex, setDayIndex] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pending, startTransition] = useTransition()

  const selectedTrip = tripOptions.find((t) => t.id === tripId)
  const suggestion = useMemo(() => suggestWindow(selectedTrip), [selectedTrip])

  // Re-suggest whenever the chosen trip changes, but never clobber an edited date.
  useEffect(() => {
    if (!suggestion) return
    setStartDate(suggestion.startDate)
    setEndDate(suggestion.endDate)
  }, [suggestion])

  const stops = useMemo(() => selectedTrip?.stops ?? [], [selectedTrip])
  const dayOptions = useMemo(() => {
    const stop = stops.find((s) => s.id === stopId)
    if (!stop) return []
    const opts: number[] = []
    for (let d = stop.startDayIndex; d <= stop.endDayIndex; d++) opts.push(d)
    return opts
  }, [stops, stopId])

  if (!target) return null

  function submit() {
    if (!tripId || !target) return
    startTransition(async () => {
      if (target.kind === 'city') {
        const result = await addStop({ tripId, cityId: target.cityId, startDate, endDate })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Stop added to your trip', {
          action: { label: 'Open builder', onClick: () => router.push(`/trips/${tripId}/build`) },
        })
        onOpenChange(false)
        router.refresh()
        return
      }

      if (!stopId) {
        toast.error('Pick a stop in that trip first.')
        return
      }
      const result = await addActivityFromExplore(target.activityId, stopId, dayIndex)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Activity added to your trip', {
        action: { label: 'Open builder', onClick: () => router.push(`/trips/${tripId}/build`) },
      })
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Trip</DialogTitle>
          <DialogDescription>
            {target.kind === 'city'
              ? 'Pick a trip — we suggest dates that do not clash with your existing stops.'
              : 'Pick the trip, stop and day this activity belongs to.'}
          </DialogDescription>
        </DialogHeader>

        {tripOptions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Create a trip first, then come back here.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Trip" htmlFor="add-trip">
              <Select
                id="add-trip"
                value={tripId}
                onChange={(e) => {
                  setTripId(e.target.value)
                  setStopId('')
                }}
              >
                {tripOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedTrip && (
              <div className="flex flex-col gap-1.5 rounded-md border border-[var(--rule)] bg-[var(--paper)] p-2.5 text-xs">
                <span className="flex items-center gap-1.5 text-[var(--ink)]">
                  <CalendarDays className="size-3.5 shrink-0 text-[var(--stamp)]" />
                  <span className="num">
                    {formatRange(parseDateInput(selectedTrip.startDate), parseDateInput(selectedTrip.endDate))}
                  </span>
                  <span className="num text-[var(--muted)]">
                    · {tripLength(parseDateInput(selectedTrip.startDate), parseDateInput(selectedTrip.endDate))} days
                  </span>
                </span>
                <span className="flex items-start gap-1.5 text-[var(--muted)]">
                  <MapPin className="size-3.5 shrink-0" />
                  {stops.length === 0 ? (
                    <span>No stops yet — this will be the first.</span>
                  ) : (
                    <span>
                      {stops.length} stop{stops.length === 1 ? '' : 's'}:{' '}
                      {stops
                        .map((s) => `${s.cityName} (days ${s.startDayIndex + 1}–${s.endDayIndex + 1})`)
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </div>
            )}

            {target.kind === 'city' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Arrives" htmlFor="add-start">
                    <Input
                      id="add-start"
                      type="date"
                      value={startDate}
                      min={selectedTrip?.startDate}
                      max={selectedTrip?.endDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Leaves" htmlFor="add-end">
                    <Input
                      id="add-end"
                      type="date"
                      value={endDate}
                      min={startDate || selectedTrip?.startDate}
                      max={selectedTrip?.endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </Field>
                </div>
                {suggestion && (
                  <p
                    className={
                      suggestion.full
                        ? 'text-xs text-[var(--transit)]'
                        : 'text-xs text-[var(--muted)]'
                    }
                  >
                    {suggestion.reason}
                  </p>
                )}
              </>
            ) : (
              <>
                <Field label="Stop" htmlFor="add-stop">
                  <Select id="add-stop" value={stopId} onChange={(e) => setStopId(e.target.value)}>
                    <option value="">Select a stop...</option>
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.cityName} (days {s.startDayIndex + 1}–{s.endDayIndex + 1})
                      </option>
                    ))}
                  </Select>
                </Field>
                {dayOptions.length > 0 && (
                  <Field label="Day" htmlFor="add-day">
                    <Select id="add-day" value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))}>
                      {dayOptions.map((d) => (
                        <option key={d} value={d}>
                          Day {d + 1}
                        </option>
                      ))}
                    </Select>
                  </Field>
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
