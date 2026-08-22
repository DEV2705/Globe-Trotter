import { notFound } from 'next/navigation'
import { requireUser, assertTripOwner } from '@/server/auth'
import { getTripFull } from '@/server/queries/trips'
import { getCityOptions, searchActivities } from '@/server/queries/catalog'
import { PageHeader } from '@/components/shell/page-header'
import { BuilderClient } from '@/components/trip/builder-client'
import type { ActivityCardDTO } from '@/server/queries/types'

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireUser()
  const trip = await getTripFull(id)
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  const cityOptions = await getCityOptions()

  const uniqueCityIds = [...new Set(trip.stops.map((s) => s.cityId))]
  const activitiesByCity: Record<string, ActivityCardDTO[]> = {}
  await Promise.all(
    uniqueCityIds.map(async (cityId) => {
      activitiesByCity[cityId] = await searchActivities({ cityId }, { take: 30 })
    })
  )

  return (
    <div>
      <PageHeader
        title={`Build: ${trip.name}`}
        description="Add stops, assign activities, and reorder your itinerary."
        breadcrumbs={[{ label: 'My Trips', href: '/trips' }, { label: trip.name }]}
      />
      <BuilderClient trip={trip} cityOptions={cityOptions} activitiesByCity={activitiesByCity} />
    </div>
  )
}
