import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSession } from '@/server/auth'
import { getPublicTrip, budgetFromTrip } from '@/server/queries/trips'
import { formatDay, formatRange } from '@/lib/dates'
import { formatMoney } from '@/lib/budget'
import { CopyTripButton } from '@/components/trip/copy-trip-button'
import { BudgetPie } from '@/components/charts/budget-pie'
import { TripRouteMap } from '@/components/trip/trip-route-map'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const trip = await getPublicTrip(slug)
  if (!trip) return { title: 'Trip not found' }
  return {
    title: `${trip.name} — GlobeTrotter`,
    description: trip.description ?? `A ${trip.totalDays}-day trip across ${trip.stops.length} stops.`,
    openGraph: {
      title: trip.name,
      description: trip.description ?? undefined,
      images: trip.coverUrl ? [trip.coverUrl] : undefined,
    },
  }
}

export default async function PublicTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const trip = await getPublicTrip(slug)
  if (!trip) notFound()

  const session = await getSession()
  const budget = budgetFromTrip(trip)
  const stopsSorted = [...trip.stops].sort((a, b) => a.order - b.order)

  return (
    <div className="min-h-screen bg-[var(--paper)] px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-t-xl border border-b-0 border-[var(--rule)] bg-[var(--surface)] p-6">
          <p className="display text-sm font-bold text-[var(--stamp)]">GlobeTrotter</p>
          <h1 className="display mt-2 text-2xl text-[var(--ink)]">{trip.name}</h1>
          {trip.description && <p className="mt-1 text-sm text-[var(--muted)]">{trip.description}</p>}
          <p className="num mt-2 text-sm text-[var(--muted)]">{formatRange(new Date(trip.startDate), new Date(trip.endDate))}</p>
          <div className="mt-4 flex items-center gap-3">
            <CopyTripButton slug={slug} isSignedIn={!!session} />
            <span className="num text-xs text-[var(--muted)]">{trip.viewCount} views</span>
          </div>
        </div>

        <div className="notch-y relative border-x border-[var(--rule)] bg-[var(--paper)]">
          <div className="border-t border-dashed border-[var(--rule)]" />
        </div>

        <div className="rounded-b-xl border border-t-0 border-[var(--rule)] bg-[var(--surface)] p-6">
          <div className="mb-6">
            <TripRouteMap stops={trip.stops} currency={trip.currency} dayDates={trip.dayDates} height={300} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_260px]">
            <div className="flex flex-col gap-3">
              {trip.dayDates.map((date, dayIndex) => {
                const stop = stopsSorted.find((s) => dayIndex >= s.startDayIndex && dayIndex <= s.endDayIndex)
                const items = stopsSorted.flatMap((s) => s.items).filter((i) => i.dayIndex === dayIndex).sort((a, b) => a.order - b.order)
                return (
                  <div key={dayIndex} className="perf-edge rounded-lg border border-[var(--rule)]">
                    <div className="perf-edge-strip" />
                    <div className="p-3">
                      <p className="display text-sm text-[var(--ink)]">
                        Day {dayIndex + 1} {stop && <span className="font-normal text-[var(--muted)]">· {stop.city.name}</span>}
                      </p>
                      <p className="num text-xs text-[var(--muted)]">{formatDay(new Date(date))}</p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {items.length === 0 ? (
                          <li className="text-xs text-[var(--muted)]">Free day.</li>
                        ) : (
                          items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between text-sm">
                              <span className="text-[var(--ink)]">{item.activity.name}</span>
                              <span className="num text-xs text-[var(--muted)]">{formatMoney(item.cost, trip.currency)}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Budget breakdown</p>
              <BudgetPie byCategory={budget.byCategory} currency={trip.currency} />
              <p className="num mt-3 text-sm text-[var(--ink)]">Total: {formatMoney(budget.total, trip.currency)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
