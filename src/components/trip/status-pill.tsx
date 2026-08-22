import { cn } from '@/lib/utils'
import type { DerivedTripStatus } from '@/server/queries/types'

const LABELS: Record<DerivedTripStatus, string> = {
  ONGOING: 'Ongoing',
  UPCOMING: 'Upcoming',
  COMPLETED: 'Completed',
}

export function StatusPill({ status, className }: { status: DerivedTripStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'ONGOING' && 'bg-[var(--stamp)] text-white',
        status === 'UPCOMING' && 'border border-[var(--stamp)] text-[var(--stamp)]',
        status === 'COMPLETED' && 'border border-[var(--rule)] text-[var(--muted)]',
        className
      )}
    >
      {LABELS[status]}
    </span>
  )
}
