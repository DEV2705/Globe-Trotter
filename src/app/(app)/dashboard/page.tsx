import Link from 'next/link'
import { Suspense } from 'react'
import { Plane, Luggage } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getDashboard } from '@/server/queries/dashboard'
import { searchCities, getCatalogFacets } from '@/server/queries/catalog'
import { formatMoney } from '@/lib/budget'
import { Button } from '@/components/ui/button'
import { Stat } from '@/components/ui/stat'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilterBar } from '@/components/shell/search-filter-bar'
import { CityCard } from '@/components/trip/city-card'
import { TripCard } from '@/components/trip/trip-card'

interface DashboardSearchParams {
  q?: string
  region?: string
  groupBy?: string
  sort?: string
  maxCostIndex?: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>
}) {
  const session = await requireUser()
  const params = await searchParams

  const [dashboard, facets] = await Promise.all([getDashboard(session.id), getCatalogFacets()])

  const cities = params.q || params.region || params.maxCostIndex
    ? await searchCities(
        {
          q: params.q,
          region: params.region,
          maxCostIndex: params.maxCostIndex ? Number(params.maxCostIndex) : undefined,
          sortBy: (params.sort as 'popularity' | 'cost' | 'name') ?? 'popularity',
        },
        { userId: session.id, take: 12 }
      )
    : dashboard.topCities

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-lg border border-[var(--rule)] bg-gradient-to-br from-[var(--stamp)] to-[var(--stamp-700)] p-8 text-white">
        <h1 className="display text-3xl">Welcome back, {session.firstName}</h1>
        <p className="mt-1 max-w-md text-white/80">
          {dashboard.counts.total === 0
            ? 'Start your first multi-city itinerary.'
            : `You have ${dashboard.counts.ongoing + dashboard.counts.upcoming} trip(s) coming up.`}
        </p>
        <Button asChild variant="transit" className="mt-4">
          <Link href="/trips/new">Plan a trip</Link>
        </Button>
      </div>

      {dashboard.highlight && (
        <Card className="mb-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Stat label="Next trip" value={dashboard.highlight.tripName} />
          <Stat
            label="Days remaining"
            value={dashboard.highlight.daysRemaining >= 0 ? dashboard.highlight.daysRemaining : 0}
          />
          <Stat label="Spend so far" value={formatMoney(dashboard.highlight.totalSpend, dashboard.highlight.currency)} />
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Cap status</span>
            <Badge variant={dashboard.highlight.capStatus === 'over' ? 'transit' : dashboard.highlight.capStatus === 'near' ? 'transit-outline' : 'stamp-outline'}>
              {dashboard.highlight.capStatus}
            </Badge>
          </div>
        </Card>
      )}

      <Suspense>
        <SearchFilterBar
          searchPlaceholder="Search bar ......"
          groupBy={{ key: 'groupBy', label: 'Group by', clearValue: 'none', options: [{ value: 'none', label: 'None' }, { value: 'region', label: 'Region' }] }}
          filters={[
            {
              key: 'region',
              label: 'Region',
              clearValue: '',
              options: [{ value: '', label: 'All regions' }, ...facets.regions.map((r) => ({ value: r, label: r }))],
            },
          ]}
          sort={{
            key: 'sort',
            label: 'Sort by...',
            clearValue: 'popularity',
            options: [
              { value: 'popularity', label: 'Popularity' },
              { value: 'cost', label: 'Cost index' },
              { value: 'name', label: 'Name' },
            ],
          }}
        />
      </Suspense>

      <section className="mb-8">
        <h2 className="display mb-3 text-lg text-[var(--ink)]">Top Regional Selections</h2>
        {cities.length === 0 ? (
          <EmptyState icon={Plane} title="No cities found" description="Try a different search or filter." />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {cities.map((c) => (
              <CityCard key={c.id} city={c} className="w-56 shrink-0" />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="display mb-3 text-lg text-[var(--ink)]">Previous Trips</h2>
        {dashboard.recent.length === 0 ? (
          <EmptyState
            icon={Luggage}
            title="No trips yet"
            description="Plan your first trip to see it here."
            action={
              <Button asChild size="sm">
                <Link href="/trips/new">Plan a trip</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.recent.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        )}
      </section>

      <Link
        href="/trips/new"
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-[var(--stamp)] px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-[var(--stamp-600)]"
      >
        <Plane className="size-4" /> Plan a trip
      </Link>
    </div>
  )
}
