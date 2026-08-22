'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarPlus, Clock, Coins, Heart, Sparkles, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/smart-image'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Meter } from '@/components/ui/stat'
import { toggleSavedCity } from '@/server/actions/auth'
import { CityItineraryDialog } from './city-itinerary-dialog'
import { LocalTimePill, WEATHER_ICONS, formatRate } from './live-bits'
import type { CityDTO } from '@/server/queries/types'
import type { CityLiveInfo, WeatherIconKey } from '@/server/queries/live-city-info'

/** Fixed-height strip: local time and FX only, so every card in the rail stays the same size. */
function LiveSection({ live }: { live: CityLiveInfo }) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {live.timezone && (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          <Clock className="size-3.5 shrink-0" />
          <LocalTimePill timezone={live.timezone} suffix=" Local" />
        </span>
      )}

      {live.currency && (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          <Coins className="size-3.5 shrink-0" />
          <span className="num truncate">{formatRate(live.currency)}</span>
        </span>
      )}
    </div>
  )
}

export function CityCard({
  city,
  live,
  className,
}: {
  city: CityDTO
  /** Omit on surfaces that do not fetch live conditions — the card renders without them. */
  live?: CityLiveInfo | null
  className?: string
}) {
  const [saved, setSaved] = useState(city.saved)
  const [pending, startTransition] = useTransition()
  const [planOpen, setPlanOpen] = useState(false)

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

  const WeatherIcon = live?.weather ? WEATHER_ICONS[live.weather.icon] : null
  // One badge only, so the image stays readable: lead with a budget win when there is one,
  // otherwise fall back to how the destination is trending.
  const budgetWin = live?.verdicts.cost.tone === 'good'
  const badge = live ? (budgetWin ? live.verdicts.cost : live.verdicts.popularity) : null
  const BadgeIcon = budgetWin ? Sparkles : TrendingUp

  return (
    <div className={cn('overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)]', className)}>
      <div className="relative h-28 w-full">
        <SmartImage src={city.imageUrl} caption={city.name} fill className="object-cover" sizes="220px" />

        {live?.weather && WeatherIcon && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[var(--ink)] shadow-sm">
            <WeatherIcon className="size-3.5 text-[var(--stamp)]" />
            <span className="num">{live.weather.tempC}°C</span>
          </span>
        )}

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

        {badge && (
          <span className="absolute bottom-2 left-2 right-2 inline-flex items-center gap-1 truncate rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[var(--ink)] shadow-sm">
            <BadgeIcon className="size-3.5 shrink-0 text-[var(--stamp)]" />
            <span className="truncate">
              {badge.emoji} {badge.label}
            </span>
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="display truncate text-sm text-[var(--ink)]">{city.name}</h3>
        <p className="text-xs text-[var(--muted)]">{city.country}</p>

        {live && <LiveSection live={live} />}

        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="num text-[var(--muted)]">Cost index {city.costIndex}</span>
        </div>
        <Meter value={city.costIndex} className="mt-1" />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="num text-[var(--muted)]">Popularity {city.popularity}</span>
        </div>
        <Meter value={city.popularity} variant="transit" className="mt-1" />

        <Button
          size="sm"
          variant="subtle"
          className="mt-3 w-full"
          onClick={() => setPlanOpen(true)}
        >
          <CalendarPlus className="size-3.5" /> View plan
        </Button>
      </div>

      <CityItineraryDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        cityId={city.id}
        cityName={city.name}
        live={live}
      />
    </div>
  )
}

/** Pulse placeholder matching the live card's shape, shown while conditions stream in. */
export function CityCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)]', className)}>
      <Skeleton className="h-28 w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-1 h-1.5 w-full" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    </div>
  )
}
