'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/smart-image'
import { Meter } from '@/components/ui/stat'
import { toggleSavedCity } from '@/server/actions/auth'
import type { CityDTO } from '@/server/queries/types'

export function CityCard({ city, className }: { city: CityDTO; className?: string }) {
  const [saved, setSaved] = useState(city.saved)
  const [pending, startTransition] = useTransition()

  function toggle() {
    setSaved((s) => !s)
    startTransition(async () => {
      const result = await toggleSavedCity(city.id)
      if (!result.ok) {
        setSaved((s) => !s)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)]', className)}>
      <div className="relative h-28 w-full">
        <SmartImage src={city.imageUrl} caption={city.name} fill className="object-cover" sizes="220px" />
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save destination'}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-[var(--transit)] shadow-sm"
        >
          <Heart className={cn('size-4', saved && 'fill-current')} />
        </button>
      </div>
      <div className="p-3">
        <h3 className="display truncate text-sm text-[var(--ink)]">{city.name}</h3>
        <p className="text-xs text-[var(--muted)]">{city.country}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="num text-[var(--muted)]">Cost index {city.costIndex}</span>
        </div>
        <Meter value={city.popularity} className="mt-1.5" />
      </div>
    </div>
  )
}
