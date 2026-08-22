'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Clock, PencilRuler, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney, formatDuration } from '@/lib/budget'
import { previewCityItinerary, createTripFromItinerary } from '@/server/actions/itinerary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { CityItinerary } from '@/server/queries/city-itinerary'
import type { CityLiveInfo } from '@/server/queries/live-city-info'

const DAY_OPTIONS = [2, 3, 5]

function ItinerarySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((d) => (
        <div key={d} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  )
}

export function CityItineraryDialog({
  open,
  onOpenChange,
  cityId,
  cityName,
  live,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cityId: string
  cityName: string
  live?: CityLiveInfo | null
}) {
  const router = useRouter()
  const [days, setDays] = useState(3)
  const [itinerary, setItinerary] = useState<CityItinerary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)

    previewCityItinerary(cityId, days).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setItinerary(result.data)
      } else {
        setItinerary(null)
        setError(result.error)
      }
      setLoading(false)
    })

    // A day-count change mid-flight must not let the stale response win.
    return () => {
      cancelled = true
    }
  }, [open, cityId, days])

  /** Saves the plan, then either lands on My Trips or opens the builder to reshape it. */
  function accept(destination: 'trips' | 'builder') {
    startSaving(async () => {
      const result = await createTripFromItinerary(cityId, days)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`"${result.data.name}" added to your trips`)
      onOpenChange(false)
      if (destination === 'builder') {
        router.push(`/trips/${result.data.id}/build`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ready-made plan for {cityName}</DialogTitle>
          <DialogDescription>
            Built from the best-rated stops in our catalogue. Add it as-is, or open the builder to
            reshape it before you commit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Length</span>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                days === d
                  ? 'border-[var(--stamp)] bg-[var(--stamp-50)] text-[var(--stamp-700)]'
                  : 'border-[var(--rule)] text-[var(--muted)] hover:bg-[var(--stamp-50)]'
              )}
            >
              {d} days
            </button>
          ))}
        </div>

        {live?.verdicts.weather && (
          <p className="rounded-md border border-[var(--rule)] bg-[var(--paper)] px-2.5 py-2 text-xs text-[var(--muted)]">
            <span aria-hidden>{live.verdicts.weather.emoji}</span> {live.verdicts.weather.label}
            {live.weather && ` · ${live.weather.label}, ${live.weather.tempC}°C right now`}
          </p>
        )}

        {loading ? (
          <ItinerarySkeleton />
        ) : error ? (
          <p className="text-sm text-[var(--muted)]">{error}</p>
        ) : itinerary ? (
          <>
            <div className="flex flex-col gap-4">
              {itinerary.days.map((day) => (
                <div key={day.dayIndex} className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Day {day.dayIndex + 1}
                  </h4>
                  {day.items.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">Free day — nothing scheduled.</p>
                  ) : (
                    day.items.map((item) => (
                      <div
                        key={item.activityId}
                        className="flex items-start justify-between gap-3 rounded-md border border-[var(--rule)] p-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--ink)]">{item.name}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                            <Clock className="size-3.5 shrink-0" />
                            <span className="num">{item.startTime}</span>
                            <span>· {formatDuration(item.durationMin)}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="num text-sm text-[var(--ink)]">{formatMoney(item.cost)}</span>
                          <Badge variant="neutral" className="text-[10px]">
                            {item.type.toLowerCase()}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>

            <p className="flex items-center gap-1.5 border-t border-[var(--rule)] pt-3 text-sm text-[var(--ink)]">
              <Wallet className="size-4 text-[var(--stamp)]" />
              <span className="num font-medium">{formatMoney(itinerary.totalCost)}</span>
              <span className="text-[var(--muted)]">
                estimated across {itinerary.activityCount} activities
              </span>
            </p>
          </>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => accept('builder')}
            disabled={!itinerary || loading}
            loading={saving}
          >
            <PencilRuler className="size-4" /> Customise in builder
          </Button>
          <Button onClick={() => accept('trips')} disabled={!itinerary || loading} loading={saving}>
            <CalendarPlus className="size-4" /> Add to My Trips
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
