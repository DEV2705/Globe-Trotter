'use client'

import { cn } from '@/lib/utils'
import { VIBES, type VibeKey } from '@/server/queries/explore-live'

export type VibeFilter = VibeKey | 'all'

/**
 * Filters the grid client-side against already-loaded results, so a vibe switch is instant
 * rather than a round trip. Counts come from the caller so an empty vibe can be disabled
 * instead of dead-ending on "no results".
 */
export function VibeFilterBar({
  value,
  onChange,
  counts,
  total,
}: {
  value: VibeFilter
  onChange: (value: VibeFilter) => void
  counts: Record<VibeKey, number>
  total: number
}) {
  const options: { key: VibeFilter; label: string; emoji: string; count: number }[] = [
    { key: 'all', label: 'All Destinations', emoji: '🌍', count: total },
    ...VIBES.map((v) => ({ key: v.key as VibeFilter, label: v.label, emoji: v.emoji, count: counts[v.key] })),
  ]

  return (
    <div
      role="group"
      aria-label="Filter by travel vibe"
      className="mb-4 flex gap-2 overflow-x-auto pb-1"
    >
      {options.map((option) => {
        const active = value === option.key
        const empty = option.count === 0
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            disabled={empty}
            aria-pressed={active}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200',
              active
                ? 'border-[var(--stamp)] bg-[var(--stamp)] text-white shadow-sm'
                : 'border-[var(--rule)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--stamp)] hover:bg-[var(--stamp-50)] hover:text-[var(--stamp-700)]',
              empty && 'cursor-not-allowed opacity-40 hover:border-[var(--rule)] hover:bg-[var(--surface)]'
            )}
          >
            <span aria-hidden>{option.emoji}</span>
            <span className="whitespace-nowrap">{option.label}</span>
            <span className={cn('num text-[10px]', active ? 'text-white/75' : 'text-[var(--muted)]')}>
              {option.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
