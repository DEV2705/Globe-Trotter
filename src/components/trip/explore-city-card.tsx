'use client'

import { useState, useTransition } from 'react'
import { BedDouble, Clock, Coins, Heart, Plane, Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/budget'
import { toggleSavedCity } from '@/server/actions/auth'
import { Button } from '@/components/ui/button'
import { SmartImage } from '@/components/ui/smart-image'
import { LocalTimePill, WEATHER_ICONS, formatRate } from './live-bits'
import { VIBE_BY_KEY, type Deal, type ExploreCityInsights } from '@/server/queries/explore-live'
import type { CityDTO } from '@/server/queries/types'

const DEAL_TONES: Record<Deal['tone'], string> = {
  hot: 'bg-[var(--transit)] text-white',
  good: 'bg-[var(--stamp)] text-white',
  info: 'bg-white/90 text-[var(--ink)]',
}

export function ExploreCityCard({
  city,
  insights,
  onOpenPreview,
  onAddToTrip,
}: {
  city: CityDTO
  insights?: ExploreCityInsights | null
  onOpenPreview: () => void
  onAddToTrip: () => void
}) {
  const [saved, setSaved] = useState(city.saved)
  const [savePending, startSaving] = useTransition()

  function toggleSave() {
    setSaved((s) => !s)
    startSaving(async () => {
      const result = await toggleSavedCity(city.id)
      if (!result.ok) {
        setSaved((s) => !s)
        toast.error(result.error)
      }
    })
  }

  const weather = insights?.live.weather
  const WeatherIcon = weather ? WEATHER_ICONS[weather.icon] : null
  // One headline deal over the image; the season line has its own slot in the body.
  const headline = insights?.deals.find((d) => d.key !== 'best-season')

  return (
    // A div, not a button: the card holds its own buttons, and nesting them is invalid HTML.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenPreview}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenPreview()
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)] text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stamp)]"
    >
      <div className="relative h-36 w-full overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
          <SmartImage src={city.imageUrl} caption={city.name} fill className="object-cover" sizes="(min-width: 1024px) 300px, 100vw" />
        </div>

        {weather && WeatherIcon && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[var(--ink)] shadow-sm backdrop-blur">
            <WeatherIcon className="size-3.5 text-[var(--stamp)]" />
            <span className="num">{weather.tempC}°C</span>
            <span className="truncate">{weather.label}</span>
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleSave()
          }}
          disabled={savePending}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save destination'}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-[var(--transit)] shadow-sm transition-transform hover:scale-110"
        >
          <Heart className={cn('size-4 transition-all', saved && 'fill-current')} />
        </button>

        {headline && (
          <span
            className={cn(
              'animate-rise absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm',
              DEAL_TONES[headline.tone]
            )}
          >
            <span aria-hidden>{headline.emoji}</span>
            <span className="truncate">{headline.label}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="display truncate text-sm text-[var(--ink)]">{city.name}</h3>
        <p className="truncate text-xs text-[var(--muted)]">
          {city.country} · {city.region}
        </p>

        {insights && insights.vibes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {insights.vibes.map((key) => (
              <span
                key={key}
                className="rounded-full border border-[var(--rule)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
              >
                {VIBE_BY_KEY[key].emoji} {VIBE_BY_KEY[key].label.split(' ')[0]}
              </span>
            ))}
          </div>
        )}

        {insights && (
          <div className="mt-2 flex flex-col gap-1 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <BedDouble className="size-3.5 shrink-0 text-[var(--stamp)]" />
              <span className="text-[var(--ink)]">
                Stays from{' '}
                <span className="num font-medium">{formatMoney(insights.stayFromPerNight)}</span>
                /night
              </span>
            </span>

            <span className="flex items-center gap-1.5">
              <Wallet className="size-3.5 shrink-0" />
              <span className="num">{formatMoney(insights.dailyBudget.total)}</span> est. per day
            </span>

            {insights.flight && (
              <span className="flex items-center gap-1.5">
                <Plane className="size-3.5 shrink-0" />
                <span className="num truncate">{insights.flight.label}</span>
              </span>
            )}

            <div className="flex items-center gap-3">
              {insights.live.timezone && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5 shrink-0" />
                  <LocalTimePill timezone={insights.live.timezone} suffix=" Local" />
                </span>
              )}
              {insights.live.currency && (
                <span className="flex items-center gap-1 truncate">
                  <Coins className="size-3.5 shrink-0" />
                  <span className="num truncate">{formatRate(insights.live.currency)}</span>
                </span>
              )}
            </div>
          </div>
        )}

        <p className="num mt-2 text-[11px] text-[var(--muted)]">
          Cost index {city.costIndex} · Popularity {city.popularity}
        </p>

        <Button
          size="sm"
          className="mt-3 w-full"
          onClick={(e) => {
            e.stopPropagation()
            onAddToTrip()
          }}
        >
          <Plus className="size-3.5" /> Add to Trip
        </Button>
      </div>
    </div>
  )
}

export function ExploreCityCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)]">
      <div className="skeleton h-36 w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton mt-2 h-8 w-full rounded" />
      </div>
    </div>
  )
}
