import { notFound } from 'next/navigation'
import { requireUser, assertTripOwner } from '@/server/auth'
import { getTripFull, budgetFromTrip } from '@/server/queries/trips'
import { PageHeader } from '@/components/shell/page-header'
import { CalendarClient } from '@/components/trip/calendar-client'

export default async function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireUser()
  const trip = await getTripFull(id)
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  const budget = budgetFromTrip(trip)

  return (
    <div>
      <PageHeader
        title="Calendar View"
        description={trip.name}
        breadcrumbs={[{ label: 'My Trips', href: '/trips' }, { label: trip.name, href: `/trips/${trip.id}` }, { label: 'Calendar' }]}
      />
      <CalendarClient trip={trip} budget={budget} />
    </div>
  )
}
