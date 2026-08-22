import { requireUser } from '@/server/auth'
import { getCityOptions } from '@/server/queries/catalog'
import { isAiConfigured } from '@/server/ai/client'
import { PageHeader } from '@/components/shell/page-header'
import { NewTripTabs } from '@/components/trip/new-trip-tabs'

export default async function NewTripPage() {
  await requireUser()
  const cityOptions = await getCityOptions()

  return (
    <div>
      <PageHeader title="Plan a new trip" description="Generate a full itinerary, or build one yourself." />
      <NewTripTabs cityOptions={cityOptions} aiEnabled={isAiConfigured()} />
    </div>
  )
}
