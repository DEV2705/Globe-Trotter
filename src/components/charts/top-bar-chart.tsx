'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'

/** Long activity names ("Kathakali dance performance with makeup demo") wrap into the
 * axis margin and collide, so the tick is truncated and the tooltip carries the full name. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}

interface AxisTickProps {
  x?: number
  y?: number
  payload?: { value?: unknown }
}

/** Recharts' default tick word-wraps to the axis width, which stacks long names into each
 * other. A plain single-line <text> plus truncation keeps one row per bar. */
function AxisTick({ x = 0, y = 0, payload, maxChars }: AxisTickProps & { maxChars: number }) {
  const full = String(payload?.value ?? '')
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="var(--muted)">
      <title>{full}</title>
      {truncate(full, maxChars)}
    </text>
  )
}

function ChartTooltip({ active, payload, countLabel }: TooltipProps<number, string> & { countLabel: string }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const label = String(entry.payload?.__label ?? '')
  const count = Number(entry.value ?? 0)
  return (
    <div className="max-w-64 rounded-md border border-[var(--rule)] bg-[var(--paper)] px-2.5 py-2 shadow-sm">
      <p className="text-xs font-medium text-[var(--ink)]">{label}</p>
      <p className="num mt-0.5 text-xs text-[var(--muted)]">
        {count} {countLabel}
        {count === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export function TopBarChart({
  data,
  dataKey,
  labelKey,
  countLabel = 'trip',
}: {
  data: Record<string, unknown>[]
  dataKey: string
  labelKey: string
  /** Singular noun for the tooltip count — pluralised automatically. */
  countLabel?: string
}) {
  // Two panels sit side by side on lg and stack on mobile, so the axis gutter that keeps
  // desktop labels readable would swallow a phone-width chart.
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = () => setIsNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const axisWidth = isNarrow ? 104 : 150
  const maxChars = isNarrow ? 14 : 20
  // Fixed 220px crammed the bars together once a panel had more than a handful of rows.
  const height = Math.max(260, data.length * 38)

  // Recharts hands the tooltip the datum, so carry the untruncated label on it.
  const rows = data.map((d) => ({ ...d, __label: String(d[labelKey] ?? '') }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--rule)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          tick={(props: AxisTickProps) => <AxisTick {...props} maxChars={maxChars} />}
          width={axisWidth}
          interval={0}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--stamp)', fillOpacity: 0.06 }}
          content={<ChartTooltip countLabel={countLabel} />}
        />
        {/* Recharts' grow-in animation needs an animation frame; without this the bars render
            empty in a backgrounded tab or a print view. */}
        <Bar
          dataKey={dataKey}
          fill="var(--stamp)"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
