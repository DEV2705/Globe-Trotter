'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyPublicTrip } from '@/server/actions/trips'

export function CopyTripButton({ slug, isSignedIn }: { slug: string; isSignedIn: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!isSignedIn) {
      router.push(`/login?next=/t/${slug}`)
      return
    }
    startTransition(async () => {
      const result = await copyPublicTrip(slug)
      if (result.ok) {
        toast.success('Trip copied to your account')
        router.push(`/trips/${result.data.tripId}/build`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button onClick={handleClick} loading={pending} variant="transit">
      <Copy className="size-4" /> Copy Trip
    </Button>
  )
}
