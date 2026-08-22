import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-[var(--rule)]/50 text-[var(--ink)]',
        stamp: 'bg-[var(--stamp)] text-white',
        'stamp-outline': 'border border-[var(--stamp)] text-[var(--stamp)]',
        transit: 'bg-[var(--transit)] text-white',
        'transit-outline': 'border border-[var(--transit)] text-[var(--transit)]',
        mono: 'bg-[var(--stamp-50)] text-[var(--stamp-700)] font-mono',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
