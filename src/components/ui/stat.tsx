import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="num text-xl font-medium text-[var(--ink)]">{value}</span>
    </div>
  )
}

export function Meter({
  value,
  max = 100,
  className,
  variant = 'stamp',
}: {
  value: number
  max?: number
  className?: string
  variant?: 'stamp' | 'transit'
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[var(--rule)]', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full', variant === 'transit' ? 'bg-[var(--transit)]' : 'bg-[var(--stamp)]')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
