'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SmartImage } from '@/components/ui/smart-image'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMoney, formatDuration } from '@/lib/budget'
import { AddToTripDialog } from './add-to-trip-dialog'
import { ExploreCityCard } from './explore-city-card'
import { CityQuickPreviewDrawer } from './city-quick-preview-drawer'
import { VibeFilterBar, type VibeFilter } from './vibe-filter-bar'
import { VIBES, type ExploreCityInsights, type VibeKey } from '@/server/queries/explore-live'
import { Search } from 'lucide-react'
import type { ActivityCardDTO, CityDTO, TripOption } from '@/server/queries/types'

export function ExploreResults({
  tab,
  cities,
  activities,
  tripOptions,
  insights = [],
}: {
  tab: 'cities' | 'activities'
  cities: CityDTO[]
  activities: ActivityCardDTO[]
  tripOptions: TripOption[]
  /** Live conditions and estimates, aligned to `cities` by id. Empty until they stream in. */
  insights?: ExploreCityInsights[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedActivity, setSelectedActivity] = useState<ActivityCardDTO | null>(activities[0] ?? null)
  const [addTarget, setAddTarget] = useState<
    { kind: 'city'; cityId: string } | { kind: 'activity'; activityId: string; cityId: string } | null
  >(null)
  const [vibe, setVibe] = useState<VibeFilter>('all')
  const [previewCity, setPreviewCity] = useState<CityDTO | null>(null)

  const insightsById = useMemo(
    () => new Map(insights.map((i) => [i.cityId, i])),
    [insights]
  )

  const vibeCounts = useMemo(() => {
    const counts = Object.fromEntries(VIBES.map((v) => [v.key, 0])) as Record<VibeKey, number>
    for (const city of cities) {
      for (const key of insightsById.get(city.id)?.vibes ?? []) counts[key] += 1
    }
    return counts
  }, [cities, insightsById])

  // Filtering happens here rather than through the URL so a vibe switch is instant.
  const visibleCities = useMemo(
    () => (vibe === 'all' ? cities : cities.filter((c) => insightsById.get(c.id)?.vibes.includes(vibe))),
    [cities, insightsById, vibe]
  )

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
          <>
            <VibeFilterBar value={vibe} onChange={setVibe} counts={vibeCounts} total={cities.length} />

            {visibleCities.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nothing matches that vibe"
                description="Pick another vibe, or go back to all destinations."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCities.map((c) => (
                  <ExploreCityCard
                    key={c.id}
                    city={c}
                    insights={insightsById.get(c.id)}
                    onOpenPreview={() => setPreviewCity(c)}
                    onAddToTrip={() => setAddTarget({ kind: 'city', cityId: c.id })}
                  />
                ))}
              </div>
            )}
          </>
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

      <CityQuickPreviewDrawer
        city={previewCity}
        insights={previewCity ? insightsById.get(previewCity.id) ?? null : null}
        open={!!previewCity}
        onOpenChange={(o) => !o && setPreviewCity(null)}
        onAddToTrip={(cityId) => setAddTarget({ kind: 'city', cityId })}
      />

      <AddToTripDialog open={!!addTarget} onOpenChange={(o) => !o && setAddTarget(null)} tripOptions={tripOptions} target={addTarget} />
    </div>
  )
}
