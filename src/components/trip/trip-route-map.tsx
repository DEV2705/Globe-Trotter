'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { TripRouteMapProps } from './trip-route-map-view'

/**
 * Leaflet touches `window` at import time, so the real map is loaded browser-side only.
 * This wrapper is the import boundary every page uses.
 */
const MapView = dynamic(() => import('./trip-route-map-view').then((m) => m.TripRouteMapView), {
  ssr: false,
  loading: () => <Skeleton className="h-[380px] w-full rounded-lg" />,
})

export function TripRouteMap(props: TripRouteMapProps) {
  return <MapView {...props} />
}

export type { TripRouteMapProps }
