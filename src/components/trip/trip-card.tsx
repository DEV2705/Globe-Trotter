'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MapPin, MoreVertical, Pencil, Trash2, Eye, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRange } from '@/lib/dates'
import { formatMoney } from '@/lib/budget'
import { deleteTrip, duplicateTrip } from '@/server/actions/trips'
import { Card } from '@/components/ui/card'
import { SmartImage } from '@/components/ui/smart-image'
import { StatusPill } from './status-pill'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown'
import type { TripCardDTO } from '@/server/queries/types'

export function TripCard({ trip }: { trip: TripCardDTO }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTrip(trip.id)
      if (result.ok) {
        toast.success('Trip deleted')
        setConfirmOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateTrip(trip.id)
      if (result.ok) {
        toast.success('Trip duplicated')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <Card className={cn('animate-rise overflow-hidden', trip.status === 'COMPLETED' && 'hatch')}>
        <div className="relative h-32 w-full">
          <SmartImage src={trip.coverUrl} caption={trip.name} fill className="object-cover" sizes="(min-width: 640px) 360px, 100vw" />
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="display truncate text-base text-[var(--ink)]">{trip.name}</h3>
                <StatusPill status={trip.status} />
              </div>
              <p className={cn('num text-sm text-[var(--muted)]', trip.status === 'COMPLETED' && 'line-through')}>
                {formatRange(new Date(trip.startDate), new Date(trip.endDate))}
              </p>
            </div>
            <Dropdown>
              <DropdownTrigger asChild>
                <button className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--stamp-50)]" aria-label="Trip actions">
                  <MoreVertical className="size-4" />
                </button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownItem asChild>
                  <Link href={`/trips/${trip.id}`} className="flex items-center gap-2">
                    <Eye className="size-4" /> View
                  </Link>
                </DropdownItem>
                <DropdownItem asChild>
                  <Link href={`/trips/${trip.id}/build`} className="flex items-center gap-2">
                    <Pencil className="size-4" /> Edit
                  </Link>
                </DropdownItem>
                <DropdownItem onSelect={handleDuplicate} className="flex items-center gap-2">
                  <Copy className="size-4" /> Duplicate
                </DropdownItem>
                <DropdownItem onSelect={() => setConfirmOpen(true)} className="flex items-center gap-2 text-red-600">
                  <Trash2 className="size-4" /> Delete
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          </div>

          {trip.cityNames.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
              <MapPin className="size-3.5" />
              {trip.cityNames.join(' → ')}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-[var(--rule)] pt-3 text-sm">
            <span className="text-[var(--muted)]">
              {trip.stopCount} {trip.stopCount === 1 ? 'stop' : 'stops'}
            </span>
            <span className="num font-medium text-[var(--ink)]">{formatMoney(trip.totalCost, trip.currency)}</span>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this trip?"
        description={`"${trip.name}" and everything in it will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        loading={pending}
        onConfirm={handleDelete}
      />
    </>
  )
}
