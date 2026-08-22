'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/utils'

export interface AvatarProps {
  src?: string | null
  firstName: string
  lastName?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = { sm: 'size-6 text-xs', md: 'size-9 text-sm', lg: 'size-16 text-lg' }

export function Avatar({ src, firstName, lastName, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-[var(--stamp-100)] text-[var(--stamp-700)]',
        SIZES[size],
        className
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={`${firstName} ${lastName ?? ''}`} className="h-full w-full object-cover" />}
      <AvatarPrimitive.Fallback className="font-mono font-medium" delayMs={src ? 400 : 0}>
        {initials(firstName, lastName)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
