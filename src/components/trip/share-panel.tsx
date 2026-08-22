'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Share2, Pencil, Copy, Check, List, CalendarDays } from 'lucide-react'
import { publishTrip, unpublishTrip } from '@/server/actions/trips'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function SharePanel({
  tripId,
  isPublic,
  shareSlug,
  appUrl,
}: {
  tripId: string
  isPublic: boolean
  shareSlug: string | null
  appUrl: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  const publicUrl = shareSlug ? `${appUrl}/t/${shareSlug}` : null

  function handlePublish() {
    startTransition(async () => {
      const result = isPublic ? await unpublishTrip(tripId) : await publishTrip(tripId)
      if (result.ok) {
        toast.success(isPublic ? 'Trip unpublished' : 'Trip published')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function copyLink() {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    toast.success('Link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" asChild>
            <span className="flex items-center gap-1.5">
              <List className="size-3.5" /> List
            </span>
          </TabsTrigger>
          <TabsTrigger value="calendar" asChild>
            <Link href={`/trips/${tripId}/calendar`} className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> Calendar
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Button asChild variant="outline" size="sm">
        <Link href={`/trips/${tripId}/build`}>
          <Pencil className="size-4" /> Edit
        </Link>
      </Button>

      <Button size="sm" loading={pending} onClick={handlePublish}>
        <Share2 className="size-4" /> {isPublic ? 'Unpublish' : 'Share'}
      </Button>

      {isPublic && publicUrl && (
        <>
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy link
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(publicUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--stamp)] hover:underline"
          >
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(publicUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--stamp)] hover:underline"
          >
            X
          </a>
        </>
      )}
    </div>
  )
}
