'use client'

import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { CityLiveInfo, WeatherIconKey } from '@/server/queries/live-city-info'

/** Shared live-data pieces used by both the dashboard city card and the Explore surfaces. */

export const WEATHER_ICONS: Record<WeatherIconKey, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  snowflake: Snowflake,
  'cloud-lightning': CloudLightning,
}

/**
 * "1 EUR ≈ ₹112" reads well; "1 IDR ≈ ₹0.01" does not, so a weak destination currency is
 * quoted the other way round — "₹1 ≈ 168 IDR".
 */
export function formatRate(currency: NonNullable<CityLiveInfo['currency']>): string {
  const { code, baseSymbol, rate } = currency
  const round = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2))

  if (rate < 0.5) return `${baseSymbol}1 ≈ ${round(1 / rate)} ${code}`
  return `1 ${code} ≈ ${baseSymbol}${round(rate)}`
}

/**
 * Ticks in the destination's own zone. Rendered only after mount: the server and the browser
 * sit in different moments (and often different zones), so a first-paint clock would be a
 * guaranteed hydration mismatch.
 */
export function LocalTimePill({ timezone, suffix = '' }: { timezone: string; suffix?: string }) {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    function tick() {
      try {
        setTime(
          new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: timezone,
          }).format(new Date())
        )
      } catch {
        // An unrecognised zone (the UTC±H fallback) is not worth a broken card.
        setTime(null)
      }
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [timezone])

  if (!time) return <Skeleton className="h-3 w-16" />
  return (
    <span className="num">
      {time}
      {suffix}
    </span>
  )
}
