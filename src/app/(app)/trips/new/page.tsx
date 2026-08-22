import { requireUser } from '@/server/auth'
import { getCityOptions } from '@/server/queries/catalog'
import { PageHeader } from '@/components/shell/page-header'
import { Panel } from '@/components/ui/card'
import { CreateTripForm } from '@/components/trip/create-trip-form'

export default async function NewTripPage() {
  await requireUser()
  const cityOptions = await getCityOptions()

  return (
    <div>
      <PageHeader title="Plan a new trip" description="Give it a name, dates, and a starting place." />
      <Panel title="Trip details" className="max-w-2xl">
        <CreateTripForm cityOptions={cityOptions} />
      </Panel>
    </div>
  )
}
