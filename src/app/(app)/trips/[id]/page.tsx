import { notFound } from 'next/navigation'
import { requireUser, assertTripOwner } from '@/server/auth'
import { getTripFull, budgetFromTrip } from '@/server/queries/trips'
import { getPackingItems } from '@/server/queries/packing'
import { isAiConfigured } from '@/server/ai/client'
import { formatDay, formatRange } from '@/lib/dates'
import { getAppUrl } from '@/lib/app-url'
import { formatMoney } from '@/lib/budget'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shell/page-header'
import { Card, Panel } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BudgetPie } from '@/components/charts/budget-pie'
import { BudgetByDayBar } from '@/components/charts/budget-by-day-bar'
import { SharePanel } from '@/components/trip/share-panel'
import { ExpenseManager } from '@/components/trip/expense-manager'
import { TripRouteMap } from '@/components/trip/trip-route-map'
import { PackingListPanel } from '@/components/trip/packing-list-panel'
import { CalendarClock } from 'lucide-react'

export default async function TripViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireUser()
  const trip = await getTripFull(id)
  if (!trip) notFound()
  assertTripOwner(trip, session.id)

  const budget = budgetFromTrip(trip)
  const appUrl = getAppUrl()
  const packingItems = await getPackingItems(id)

  const stopsSorted = [...trip.stops].sort((a, b) => a.order - b.order)

  return (
    <div>
      <PageHeader
        title="Itinerary for a selected place"
        description={`${trip.name} — ${formatRange(new Date(trip.startDate), new Date(trip.endDate))}`}
        breadcrumbs={[{ label: 'My Trips', href: '/trips' }, { label: trip.name }]}
      />

      <div className="mb-6">
        <SharePanel tripId={trip.id} isPublic={trip.isPublic} shareSlug={trip.shareSlug} appUrl={appUrl} />
      </div>

      <div className="mb-6">
        <Panel title="Route map" description="Every stop in order — switch to a day to zoom into its activities.">
          <TripRouteMap stops={trip.stops} currency={trip.currency} dayDates={trip.dayDates} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {trip.dayDates.map((date, dayIndex) => {
            const stop = stopsSorted.find((s) => dayIndex >= s.startDayIndex && dayIndex <= s.endDayIndex)
            const items = stopsSorted
              .flatMap((s) => s.items)
              .filter((i) => i.dayIndex === dayIndex)
              .sort((a, b) => a.order - b.order)
            const dayExpenses = trip.expenses.filter((e) => e.dayIndex === dayIndex)
            const dayBudget = budget.byDay[dayIndex]

            return (
              <div key={dayIndex} className="perf-edge rounded-lg border border-[var(--rule)] bg-[var(--surface)]">
                <div className="perf-edge-strip" />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className={cn('display text-base', dayBudget?.overCap ? 'text-[var(--transit)]' : 'text-[var(--ink)]')}>
                        Day {dayIndex + 1}
                        {stop && <span className="ml-2 text-sm font-normal text-[var(--muted)]">{stop.city.name}</span>}
                      </h2>
                      <time className="num text-xs text-[var(--muted)]">{formatDay(new Date(date))}</time>
                    </div>
                    {dayBudget && (
                      <div className="text-right">
                        <span className={cn('num text-sm font-medium', dayBudget.overCap ? 'text-[var(--transit)]' : 'text-[var(--ink)]')}>
                          {formatMoney(dayBudget.amount, trip.currency)}
                        </span>
                        {dayBudget.overCap && (
                          <p className="text-xs text-[var(--transit)]">Over budget</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Physical Activity</p>
                      {items.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">Nothing planned.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                              <span className="min-w-0 truncate text-[var(--ink)]">
                                <span className="num text-xs text-[var(--muted)]">{item.startTime ?? '--:--'}</span>{' '}
                                {item.activity.name}
                              </span>
                              <span className="num shrink-0 text-xs text-[var(--muted)]">{formatMoney(item.cost, trip.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Expense</p>
                      {dayExpenses.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">None recorded.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {dayExpenses.map((e) => (
                            <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate text-[var(--ink)]">{e.label}</span>
                              <span className="num shrink-0 text-xs text-[var(--muted)]">{formatMoney(e.amount, trip.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {trip.dayDates.length === 0 && (
            <EmptyState icon={CalendarClock} title="No days yet" description="Add a stop in the builder to get started." />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Budget by category">
            <BudgetPie byCategory={budget.byCategory} currency={trip.currency} />
          </Panel>
          <Panel title="Budget by day">
            <BudgetByDayBar byDay={budget.byDay} currency={trip.currency} />
          </Panel>
          <Card className="grid grid-cols-2 gap-4 p-4">
            <Stat label="Avg / day" value={formatMoney(budget.avgPerDay, trip.currency)} />
            <Stat label="Total spend" value={formatMoney(budget.total, trip.currency)} />
            {budget.budgetCap !== null && (
              <>
                <Stat label="Budget cap" value={formatMoney(budget.budgetCap, trip.currency)} />
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Cap status</span>
                  <Badge variant={budget.capStatus === 'over' ? 'transit' : budget.capStatus === 'near' ? 'transit-outline' : 'stamp-outline'}>
                    {budget.capStatus}
                  </Badge>
                </div>
              </>
            )}
          </Card>
          {budget.overBudgetDays.length > 0 && (
            <Card className="border-[var(--transit)] bg-[var(--transit-50)] p-4 text-sm text-[var(--transit-700)]">
              Over budget on: {budget.overBudgetDays.map((d) => `Day ${d + 1}`).join(', ')}
            </Card>
          )}
          <Panel title="Expenses">
            <ExpenseManager
              tripId={trip.id}
              currency={trip.currency}
              expenses={trip.expenses}
              stopOptions={stopsSorted.map((s) => ({ id: s.id, label: s.city.name }))}
              members={trip.members}
            />
          </Panel>
          <PackingListPanel tripId={trip.id} items={packingItems} aiEnabled={isAiConfigured()} />
        </div>
      </div>
    </div>
  )
}
