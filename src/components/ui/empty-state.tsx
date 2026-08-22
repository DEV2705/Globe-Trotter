import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--rule)] px-6 py-12 text-center animate-rise',
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-[var(--stamp-50)] text-[var(--stamp)]">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="display text-base text-[var(--ink)]">{title}</h3>
      <p className="max-w-sm text-sm text-[var(--muted)]">{description}</p>
      {action}
    </div>
  )
}
