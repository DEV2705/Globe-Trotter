import { cn } from '@/lib/utils'

export function GroupHeading({
  label,
  count,
  className,
}: {
  label: string
  count?: number
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-center gap-2', className)}>
      <span className="size-1.5 rounded-full bg-[var(--stamp)]" aria-hidden />
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</h2>
      {count !== undefined && <span className="num text-xs text-[var(--muted)]">({count})</span>}
      <div className="h-px flex-1 bg-[var(--rule)]" />
    </div>
  )
}
