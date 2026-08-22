import { Suspense } from 'react'
import { requireUser } from '@/server/auth'
import { searchCities, searchActivities, getCatalogFacets } from '@/server/queries/catalog'
import { getTripOptions } from '@/server/queries/trips'
import { PageHeader } from '@/components/shell/page-header'
import { SearchFilterBar } from '@/components/shell/search-filter-bar'
import { ExploreResults } from '@/components/trip/explore-results'
import { ExploreCityCardSkeleton } from '@/components/trip/explore-city-card'
import { getExploreCitiesInsights } from '@/server/queries/explore-live'
import type { ActivityCardDTO, CityDTO, TripOption } from '@/server/queries/types'

interface ExploreSearchParams {
  tab?: string
  q?: string
  region?: string
  country?: string
  type?: string
  maxCost?: string
  maxCostIndex?: string
  sort?: string
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<ExploreSearchParams> }) {
  const session = await requireUser()
  const params = await searchParams
  const tab = params.tab === 'activities' ? 'activities' : 'cities'

  const [facets, tripOptions] = await Promise.all([getCatalogFacets(), getTripOptions(session.id)])

  const cities =
    tab === 'cities'
      ? await searchCities(
          {
            q: params.q,
            region: params.region,
            maxCostIndex: params.maxCostIndex ? Number(params.maxCostIndex) : undefined,
            sortBy: (params.sort as 'popularity' | 'cost' | 'name') ?? 'popularity',
          },
          { userId: session.id, take: 60 }
        )
      : []

  const activities =
    tab === 'activities'
      ? await searchActivities(
          {
            q: params.q,
            region: params.region,
            type: params.type as never,
            maxCost: params.maxCost ? Number(params.maxCost) : undefined,
            sortBy: (params.sort as 'popularity' | 'cost' | 'duration' | 'name') ?? 'popularity',
          },
          { take: 60 }
        )
      : []

  return (
    <div>
      <PageHeader title="Explore" description="Search cities and activities — try Paragliding." />

      <Suspense>
        <SearchFilterBar
          searchPlaceholder={tab === 'activities' ? 'Paragliding' : 'Search bar ......'}
          filters={[
            {
              key: 'region',
              label: 'Region',
              clearValue: '',
              options: [{ value: '', label: 'All regions' }, ...facets.regions.map((r) => ({ value: r, label: r }))],
            },
            ...(tab === 'activities'
              ? [
                  {
                    key: 'type',
                    label: 'Type',
                    clearValue: '',
                    options: [
                      { value: '', label: 'All types' },
                      { value: 'SIGHTSEEING', label: 'Sightseeing' },
                      { value: 'FOOD', label: 'Food' },
                      { value: 'ADVENTURE', label: 'Adventure' },
                      { value: 'CULTURE', label: 'Culture' },
                      { value: 'NATURE', label: 'Nature' },
                      { value: 'NIGHTLIFE', label: 'Nightlife' },
                      { value: 'RELAX', label: 'Relax' },
                      { value: 'SHOPPING', label: 'Shopping' },
                    ],
                  },
                ]
              : []),
          ]}
          sort={{
            key: 'sort',
            label: 'Sort by...',
            clearValue: 'popularity',
            options:
              tab === 'activities'
                ? [
                    { value: 'popularity', label: 'Popularity' },
                    { value: 'cost', label: 'Cost' },
                    { value: 'duration', label: 'Duration' },
                    { value: 'name', label: 'Name' },
                  ]
                : [
                    { value: 'popularity', label: 'Popularity' },
                    { value: 'cost', label: 'Cost index' },
                    { value: 'name', label: 'Name' },
                  ],
          }}
        />
      </Suspense>

      {tab === 'cities' && cities.length > 0 ? (
        <Suspense
          key={cities.map((c) => c.id).join(',')}
          fallback={<ExploreResultsSkeleton count={Math.min(cities.length, 6)} />}
        >
          <LiveExploreResults cities={cities} activities={activities} tripOptions={tripOptions} />
        </Suspense>
      ) : (
        <ExploreResults tab={tab} cities={cities} activities={activities} tripOptions={tripOptions} />
      )}
    </div>
  )
}

/** Streams the grid in once the weather/FX providers answer, so the search bar paints first. */
async function LiveExploreResults({
  cities,
  activities,
  tripOptions,
}: {
  cities: CityDTO[]
  activities: ActivityCardDTO[]
  tripOptions: TripOption[]
}) {
  const insights = await getExploreCitiesInsights(cities)
  return (
    <ExploreResults
      tab="cities"
      cities={cities}
      activities={activities}
      tripOptions={tripOptions}
      insights={insights}
    />
  )
}

function ExploreResultsSkeleton({ count }: { count: number }) {
  return (
    <div>
      <div className="skeleton mb-4 h-8 w-full max-w-xl rounded-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <ExploreCityCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
