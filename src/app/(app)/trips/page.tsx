import Link from 'next/link'
import { Suspense } from 'react'
import { Luggage } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getTrips } from '@/server/queries/trips'
import { PageHeader } from '@/components/shell/page-header'
import { GroupHeading } from '@/components/shell/group-heading'
import { SearchFilterBar } from '@/components/shell/search-filter-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { TripCard } from '@/components/trip/trip-card'

interface TripsSearchParams {
  q?: string
  sort?: string
}

export default async function TripsPage({ searchParams }: { searchParams: Promise<TripsSearchParams> }) {
  const session = await requireUser()
  const params = await searchParams

  const { ongoing, upcoming, completed, total } = await getTrips(session.id, {
    q: params.q,
    sort: (params.sort as 'start-desc' | 'start-asc' | 'name' | 'cost') ?? 'start-desc',
  })

  return (
    <div>
      <PageHeader
        title="My Trips"
        description="Every trip you've planned, grouped by status."
        action={
          <Button asChild>
            <Link href="/trips/new">Plan a trip</Link>
          </Button>
        }
      />

      <Suspense>
        <SearchFilterBar
          searchPlaceholder="Search bar ......"
          sort={{
            key: 'sort',
            label: 'Sort by...',
            clearValue: 'start-desc',
            options: [
              { value: 'start-desc', label: 'Start date (newest)' },
              { value: 'start-asc', label: 'Start date (oldest)' },
              { value: 'name', label: 'Name' },
              { value: 'cost', label: 'Total cost' },
            ],
          }}
        />
      </Suspense>

      {total === 0 ? (
        <EmptyState
          icon={Luggage}
          title="No trips yet"
          description="Plan your first multi-city trip to see it here."
          action={
            <Button asChild>
              <Link href="/trips/new">Plan a trip</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          <TripGroup label="Ongoing" trips={ongoing} />
          <TripGroup label="Up-coming" trips={upcoming} />
          <TripGroup label="Completed" trips={completed} />
        </div>
      )}
    </div>
  )
}

function TripGroup({ label, trips }: { label: string; trips: Awaited<ReturnType<typeof getTrips>>['all'] }) {
  if (trips.length === 0) return null
  return (
    <section>
      <GroupHeading label={label} count={trips.length} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </div>
    </section>
  )
}
