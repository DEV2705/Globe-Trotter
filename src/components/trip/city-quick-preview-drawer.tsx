'use client'

import { useEffect, useState } from 'react'
import { Clock, Coins, Plane, Plus, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, formatDuration } from '@/lib/budget'
import { topCityActivities, type CuratedActivity } from '@/server/actions/explore'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { SmartImage } from '@/components/ui/smart-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LocalTimePill, formatRate } from './live-bits'
import { BUDGET_SHARES, type ExploreCityInsights } from '@/server/queries/explore-live'
import type { CityDTO } from '@/server/queries/types'

const BUDGET_ROWS = [
  { key: 'stay', label: 'Stay', className: 'bg-[var(--stamp)]' },
  { key: 'food', label: 'Food', className: 'bg-[var(--transit)]' },
  { key: 'activities', label: 'Activities', className: 'bg-[var(--stamp-600)]' },
  { key: 'transport', label: 'Local transport', className: 'bg-[var(--muted)]' },
] as const

export function CityQuickPreviewDrawer({
  city,
  insights,
  open,
  onOpenChange,
  onAddToTrip,
}: {
  city: CityDTO | null
  insights: ExploreCityInsights | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToTrip: (cityId: string) => void
}) {
  const [activities, setActivities] = useState<CuratedActivity[] | null>(null)
  const [loading, setLoading] = useState(false)

  const cityId = city?.id ?? null

  useEffect(() => {
    if (!open || !cityId) return
    let cancelled = false
    setLoading(true)
    setActivities(null)

    topCityActivities(cityId, 4).then((result) => {
      if (cancelled) return
      setActivities(result.ok ? result.data : [])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, cityId])

  if (!city) return null

  const budget = insights?.dailyBudget

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-md p-0">
        <div className="relative h-44 w-full shrink-0">
          <SmartImage src={city.imageUrl} caption={city.name} fill className="object-cover" sizes="448px" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <SheetTitle className="display text-xl text-white">{city.name}</SheetTitle>
            <SheetDescription className="text-xs text-white/80">
              {city.country} · {city.region}
            </SheetDescription>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-5 pt-1">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Live travel snapshot
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <SnapshotTile
                label="Weather now"
                value={
                  insights?.live.weather
                    ? `${insights.live.weather.emoji} ${insights.live.weather.tempC}°C`
                    : '—'
                }
                sub={insights?.live.weather?.label ?? 'Unavailable'}
              />
              <SnapshotTile
                label="Local time"
                value={
                  insights?.live.timezone ? <LocalTimePill timezone={insights.live.timezone} /> : '—'
                }
                sub={insights?.live.timezone ?? 'Unknown zone'}
                icon={<Clock className="size-3.5" />}
              />
              <SnapshotTile
                label="Currency"
                value={insights?.live.currency ? formatRate(insights.live.currency) : '—'}
                sub="Live mid-market rate"
                icon={<Coins className="size-3.5" />}
              />
              <SnapshotTile
                label="Best season"
                value={insights?.season.window ?? '—'}
                sub={insights?.season.inSeason ? 'In season now' : 'Off-peak right now'}
              />
            </div>

            {insights?.flight && (
              <p className="mt-2 flex items-center gap-1.5 rounded-md border border-[var(--rule)] bg-[var(--paper)] px-2.5 py-2 text-xs text-[var(--muted)]">
                <Plane className="size-3.5 shrink-0 text-[var(--stamp)]" />
                <span className="num">{insights.flight.label}</span>
                <span className="num ml-auto">{insights.flight.distanceKm.toLocaleString('en-IN')} km</span>
              </p>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Top must-do activities
            </h4>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="flex flex-col gap-2">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 rounded-md border border-[var(--rule)] p-2"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-md">
                      <SmartImage
                        src={activity.imageUrl}
                        caption={activity.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{activity.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="neutral" className="text-[10px] lowercase">
                          {activity.type.toLowerCase()}
                        </Badge>
                        <span className="num text-[11px] text-[var(--muted)]">
                          {formatDuration(activity.durationMin)}
                        </span>
                        <span className="num flex items-center gap-0.5 text-[11px] text-[var(--muted)]">
                          <Star className="size-3 fill-current text-[var(--sun,#C9A227)]" />
                          {activity.rating}
                        </span>
                      </div>
                    </div>
                    <span className="num shrink-0 text-sm text-[var(--ink)]">
                      {formatMoney(activity.avgCost)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">Nothing catalogued here yet.</p>
            )}
          </section>

          {budget && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Estimated daily budget
              </h4>
              <p className="num mb-2 text-lg font-medium text-[var(--ink)]">
                {formatMoney(budget.total)}
                <span className="ml-1 text-xs font-normal text-[var(--muted)]">per person, per day</span>
              </p>

              {/* Single stacked bar first, so the split reads at a glance before the rows. */}
              <div className="mb-3 flex h-2 w-full overflow-hidden rounded-full">
                {BUDGET_ROWS.map((row) => (
                  <div
                    key={row.key}
                    className={row.className}
                    style={{ width: `${BUDGET_SHARES[row.key] * 100}%` }}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                {BUDGET_ROWS.map((row) => (
                  <div key={row.key} className="flex items-center gap-2 text-xs">
                    <span className={cn('size-2 shrink-0 rounded-full', row.className)} />
                    <span className="text-[var(--ink)]">{row.label}</span>
                    <span className="num ml-auto text-[var(--muted)]">
                      {Math.round(BUDGET_SHARES[row.key] * 100)}%
                    </span>
                    <span className="num w-20 text-right text-[var(--ink)]">
                      {formatMoney(budget[row.key])}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false)
              onAddToTrip(city.id)
            }}
          >
            <Plus className="size-4" /> Add {city.name} to a trip
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SnapshotTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: React.ReactNode
  sub: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-[var(--rule)] bg-[var(--paper)] p-2.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </p>
      <div className="num mt-1 truncate text-sm font-medium text-[var(--ink)]">{value}</div>
      <p className="truncate text-[11px] text-[var(--muted)]">{sub}</p>
    </div>
  )
}
