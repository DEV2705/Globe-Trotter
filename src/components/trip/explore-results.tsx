'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SmartImage } from '@/components/ui/smart-image'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMoney, formatDuration } from '@/lib/budget'
import { AddToTripDialog } from './add-to-trip-dialog'
import { Search } from 'lucide-react'
import type { ActivityCardDTO, CityDTO, TripOption } from '@/server/queries/types'

export function ExploreResults({
  tab,
  cities,
  activities,
  tripOptions,
}: {
  tab: 'cities' | 'activities'
  cities: CityDTO[]
  activities: ActivityCardDTO[]
  tripOptions: TripOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedActivity, setSelectedActivity] = useState<ActivityCardDTO | null>(activities[0] ?? null)
  const [addTarget, setAddTarget] = useState<
    { kind: 'city'; cityId: string } | { kind: 'activity'; activityId: string; cityId: string } | null
  >(null)

  function setTab(next: 'cities' | 'activities') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'cities' | 'activities')}>
        <TabsList className="mb-4">
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'cities' ? (
        cities.length === 0 ? (
          <EmptyState icon={Search} title="No cities found" description="Try a different search or filter." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)]">
                <div className="relative h-32 w-full">
                  <SmartImage src={c.imageUrl} caption={c.name} fill className="object-cover" sizes="300px" />
                </div>
                <div className="p-3">
                  <h3 className="display text-sm text-[var(--ink)]">{c.name}</h3>
                  <p className="text-xs text-[var(--muted)]">
                    {c.country} · {c.region}
                  </p>
                  <p className="num mt-1 text-xs text-[var(--muted)]">Cost index {c.costIndex} · Popularity {c.popularity}</p>
                  <Button size="sm" className="mt-2 w-full" onClick={() => setAddTarget({ kind: 'city', cityId: c.id })}>
                    <Plus className="size-3.5" /> Add to Trip
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-2">
            {activities.length === 0 ? (
              <EmptyState icon={Search} title="No activities found" description="Try Paragliding, or clear a filter." />
            ) : (
              activities.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedActivity(a)}
                  className={`flex items-center justify-between gap-3 rounded-md border p-3 text-left ${
                    selectedActivity?.id === a.id ? 'border-[var(--stamp)] bg-[var(--stamp-50)]' : 'border-[var(--rule)] hover:bg-[var(--stamp-50)]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">{a.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {a.cityName}, {a.country}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm text-[var(--ink)]">{formatMoney(a.avgCost)}</span>
                </button>
              ))
            )}
          </div>

          <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-4">
            {selectedActivity ? (
              <>
                <div className="relative mb-3 h-40 w-full overflow-hidden rounded-md">
                  <SmartImage src={selectedActivity.imageUrl} caption={selectedActivity.name} fill className="object-cover" sizes="360px" />
                </div>
                <h3 className="display text-base text-[var(--ink)]">{selectedActivity.name}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {selectedActivity.cityName}, {selectedActivity.country}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="neutral">{selectedActivity.type}</Badge>
                  <Badge variant="mono">{formatMoney(selectedActivity.avgCost)}</Badge>
                  <Badge variant="mono">{formatDuration(selectedActivity.durationMin)}</Badge>
                  <Badge variant="mono">★ {selectedActivity.rating}</Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--ink)]">{selectedActivity.description}</p>
                <Button
                  className="mt-4 w-full"
                  onClick={() =>
                    setAddTarget({ kind: 'activity', activityId: selectedActivity.id, cityId: selectedActivity.cityId })
                  }
                >
                  <Plus className="size-4" /> Add to Trip
                </Button>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Select an activity to see its details.</p>
            )}
          </div>
        </div>
      )}

      <AddToTripDialog open={!!addTarget} onOpenChange={(o) => !o && setAddTarget(null)} tripOptions={tripOptions} target={addTarget} />
    </div>
  )
}
