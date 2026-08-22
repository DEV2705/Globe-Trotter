import { getCitiesLiveInfo } from '@/server/queries/live-city-info'
import { CityCard, CityCardSkeleton } from './city-card'
import type { CityDTO } from '@/server/queries/types'

const CARD_WIDTH = 'w-56 shrink-0'

/**
 * Async so the rest of the dashboard paints immediately: the rail streams in behind a
 * Suspense boundary once the weather and FX providers answer.
 */
export async function LiveCityRail({ cities, homeCurrency }: { cities: CityDTO[]; homeCurrency?: string }) {
  const live = await getCitiesLiveInfo(cities, homeCurrency)

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {cities.map((city, i) => (
        <CityCard key={city.id} city={city} live={live[i] ?? null} className={CARD_WIDTH} />
      ))}
    </div>
  )
}

export function LiveCityRailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <CityCardSkeleton key={i} className={CARD_WIDTH} />
      ))}
    </div>
  )
}
