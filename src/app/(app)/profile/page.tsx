import Link from 'next/link'
import { requireUser } from '@/server/auth'
import { db } from '@/server/db'
import { getSavedCities } from '@/server/queries/catalog'
import { getTrips } from '@/server/queries/trips'
import { PageHeader } from '@/components/shell/page-header'
import { Panel } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusPill } from '@/components/trip/status-pill'
import { ProfileForm } from '@/components/trip/profile-form'
import { DeleteAccountButton } from '@/components/trip/delete-account-button'
import { formatRange } from '@/lib/dates'
import { MapPin, Luggage } from 'lucide-react'

export default async function ProfilePage() {
  const session = await requireUser()
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      city: true,
      country: true,
      bio: true,
      photoUrl: true,
      language: true,
    },
  })

  const [savedCities, { upcoming, completed, ongoing }] = await Promise.all([
    getSavedCities(session.id),
    getTrips(session.id),
  ])

  const previous = [...ongoing, ...completed]

  return (
    <div>
      <PageHeader title="Profile" description="Your details, saved places and trip history." />

      <Panel title="User Details" className="mb-6">
        <ProfileForm
          initial={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone ?? undefined,
            city: user.city ?? undefined,
            country: user.country ?? undefined,
            bio: user.bio ?? undefined,
            photoUrl: user.photoUrl ?? undefined,
            language: user.language,
          }}
        />
      </Panel>

      <Panel title="Saved destinations" className="mb-6">
        {savedCities.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No saved destinations yet"
            description="Save a city from the dashboard or Explore to see it here."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {savedCities.map((c) => (
              <span key={c.id} className="rounded-full border border-[var(--rule)] px-3 py-1 text-sm">
                {c.name}, {c.country}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Preplanned Trips" className="mb-6">
        {upcoming.length === 0 ? (
          <EmptyState icon={Luggage} title="Nothing planned yet" description="Create a trip to see it here." />
        ) : (
          <TripRows trips={upcoming} />
        )}
      </Panel>

      <Panel title="Previous Trips" className="mb-6">
        {previous.length === 0 ? (
          <EmptyState icon={Luggage} title="No trip history yet" description="Your ongoing and completed trips will show here." />
        ) : (
          <TripRows trips={previous} />
        )}
      </Panel>

      <Panel title="Danger zone">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Deleting your account permanently removes all of your trips. This cannot be undone.
        </p>
        <DeleteAccountButton />
      </Panel>
    </div>
  )
}

function TripRows({ trips }: { trips: { id: string; name: string; startDate: string; endDate: string; status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' }[] }) {
  return (
    <ul className="divide-y divide-[var(--rule)]">
      {trips.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">{t.name}</p>
            <p className="num text-xs text-[var(--muted)]">{formatRange(new Date(t.startDate), new Date(t.endDate))}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={t.status} />
            <Button asChild size="sm" variant="outline">
              <Link href={`/trips/${t.id}`}>View</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
