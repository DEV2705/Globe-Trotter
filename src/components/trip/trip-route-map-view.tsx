'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/budget'
import type { StopDTO, TripActivityDTO } from '@/server/queries/types'

export interface TripRouteMapProps {
  stops: StopDTO[]
  currency: string
  dayDates: string[]
  className?: string
  /** Compact height for the public share page. */
  height?: number
}

interface Located {
  lat: number
  lng: number
}

interface StopPoint extends Located {
  id: string
  order: number
  cityName: string
  country: string
  startDayIndex: number
  endDayIndex: number
  items: TripActivityDTO[]
}

/** Matches the activity-type colours used by the calendar chips. */
const TYPE_COLORS: Record<string, string> = {
  SIGHTSEEING: '#1F4B3F',
  FOOD: '#C9A227',
  ADVENTURE: '#E0642B',
  CULTURE: '#3E7C6A',
  NATURE: '#2E7D32',
  NIGHTLIFE: '#7C3AED',
  RELAX: '#0EA5E9',
  SHOPPING: '#DB2777',
}

const ROUTE_COLOR = '#1F4B3F'

/**
 * Leaflet's default marker icons are resolved from a CSS-relative sprite path that the
 * bundler rewrites, so every marker would 404. Numbered divIcons sidestep that entirely
 * and double as the stop ordering.
 */
function stopIcon(order: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:9999px;
      background:${ROUTE_COLOR};color:#fff;
      font:600 12px/1 ui-sans-serif,system-ui,sans-serif;
      box-shadow:0 1px 4px rgba(0,0,0,.35);border:2px solid #fff;
    ">${order}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

function activityIcon(type: string): L.DivIcon {
  const color = TYPE_COLORS[type] ?? '#6B7280'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:12px;height:12px;border-radius:9999px;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 3px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6],
  })
}

/**
 * A great-circle arc rendered as a short polyline, so a long hop reads as a curve rather
 * than a straight line cutting across the projection.
 */
function geodesicPath(from: Located, to: Located, segments = 48): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const lat1 = toRad(from.lat)
  const lng1 = toRad(from.lng)
  const lat2 = toRad(to.lat)
  const lng2 = toRad(to.lng)

  const d =
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
        )
      )
    )
  // Coincident points have no arc to draw, and the interpolation below would divide by zero.
  if (d === 0) return [[from.lat, from.lng]]

  return Array.from({ length: segments + 1 }, (_, i) => {
    const f = i / segments
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
    const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
    const z = a * Math.sin(lat1) + b * Math.sin(lat2)
    return [toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))] as [number, number]
  })
}

/** Drives the camera from React state — the map itself stays uncontrolled. */
function CameraController({ bounds, center }: { bounds: [number, number][]; center: Located | null }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], 11, { duration: 0.6 })
      return
    }
    if (bounds.length === 0) return
    if (bounds.length === 1) {
      map.flyTo(bounds[0], 9, { duration: 0.6 })
      return
    }
    map.flyToBounds(L.latLngBounds(bounds), { padding: [40, 40], duration: 0.6 })
  }, [map, bounds, center])

  return null
}

export function TripRouteMapView({ stops, currency, dayDates, className, height = 380 }: TripRouteMapProps) {
  const [focusStopId, setFocusStopId] = useState<string | null>(null)

  const points = useMemo<StopPoint[]>(
    () =>
      [...stops]
        .sort((a, b) => a.order - b.order)
        .flatMap((stop) => {
          const { lat, lng } = stop.city
          // A city with no coordinates cannot be placed; it is listed under the map instead.
          if (lat === null || lng === null) return []
          return [
            {
              id: stop.id,
              order: stop.order,
              lat,
              lng,
              cityName: stop.city.name,
              country: stop.city.country,
              startDayIndex: stop.startDayIndex,
              endDayIndex: stop.endDayIndex,
              items: stop.items,
            },
          ]
        }),
    [stops]
  )

  const missing = stops.length - points.length
  const focused = points.find((p) => p.id === focusStopId) ?? null
  const bounds = useMemo<[number, number][]>(() => points.map((p) => [p.lat, p.lng]), [points])

  const legs = useMemo(
    () =>
      points.slice(0, -1).map((from, i) => ({
        key: `${from.id}-${points[i + 1].id}`,
        path: geodesicPath(from, points[i + 1]),
      })),
    [points]
  )

  if (points.length === 0) {
    return (
      <p className={cn('text-sm text-[var(--muted)]', className)}>
        No mapped stops yet — add a stop with a known location to see the route.
      </p>
    )
  }

  const visible = focused ? [focused] : points

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFocusStopId(null)}
          aria-pressed={focused === null}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
            focused === null
              ? 'border-[var(--stamp)] bg-[var(--stamp-50)] text-[var(--stamp-700)]'
              : 'border-[var(--rule)] text-[var(--muted)] hover:bg-[var(--stamp-50)]'
          )}
        >
          Full route
        </button>
        {points.map((point) => (
          <button
            key={point.id}
            type="button"
            onClick={() => setFocusStopId(point.id)}
            aria-pressed={focused?.id === point.id}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              focused?.id === point.id
                ? 'border-[var(--stamp)] bg-[var(--stamp-50)] text-[var(--stamp-700)]'
                : 'border-[var(--rule)] text-[var(--muted)] hover:bg-[var(--stamp-50)]'
            )}
          >
            Day {point.startDayIndex + 1}
            {point.endDayIndex !== point.startDayIndex ? `–${point.endDayIndex + 1}` : ''} · {point.cityName}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--rule)]" style={{ height }}>
        <MapContainer
          center={[points[0].lat, points[0].lng]}
          zoom={4}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <CameraController bounds={bounds} center={focused} />

          {!focused &&
            legs.map((leg) => (
              <Polyline
                key={leg.key}
                positions={leg.path}
                pathOptions={{ color: ROUTE_COLOR, weight: 3, opacity: 0.75, dashArray: '6 6' }}
              />
            ))}

          {visible.map((point) => (
            <Marker key={point.id} position={[point.lat, point.lng]} icon={stopIcon(point.order + 1)}>
              <Popup>
                <strong>
                  Stop {point.order + 1}: {point.cityName}
                </strong>
                <br />
                <span style={{ color: '#6B7280' }}>
                  {point.country} · Day {point.startDayIndex + 1}
                  {point.endDayIndex !== point.startDayIndex ? `–${point.endDayIndex + 1}` : ''}
                  {dayDates[point.startDayIndex] ? ` · ${dayDates[point.startDayIndex]}` : ''}
                </span>
                <br />
                <span style={{ color: '#6B7280' }}>
                  {point.items.length} {point.items.length === 1 ? 'activity' : 'activities'}
                </span>
              </Popup>
            </Marker>
          ))}

          {/* Activities sit at their city's coordinates, so they are fanned out around the pin
              rather than stacked invisibly underneath it. */}
          {focused &&
            focused.items.map((item, i) => {
              const angle = (i / Math.max(1, focused.items.length)) * Math.PI * 2
              const radius = 0.012
              return (
                <Marker
                  key={item.id}
                  position={[focused.lat + Math.sin(angle) * radius, focused.lng + Math.cos(angle) * radius]}
                  icon={activityIcon(item.activity.type)}
                >
                  <Popup>
                    {item.activity.imageUrl && (
                      // Leaflet popups render outside the React tree that next/image needs.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.activity.imageUrl}
                        alt=""
                        style={{
                          width: '100%',
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 6,
                          marginBottom: 6,
                        }}
                      />
                    )}
                    <strong>{item.activity.name}</strong>
                    <br />
                    <span style={{ color: '#6B7280' }}>
                      {item.startTime ?? '--:--'} · Day {item.dayIndex + 1}
                    </span>
                    <br />
                    <span style={{ color: '#6B7280' }}>
                      {item.activity.type.toLowerCase()} · {formatMoney(item.cost, currency)}
                    </span>
                  </Popup>
                </Marker>
              )
            })}
        </MapContainer>
      </div>

      {missing > 0 && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {missing} stop{missing === 1 ? '' : 's'} could not be mapped — no coordinates on record.
        </p>
      )}
    </div>
  )
}
