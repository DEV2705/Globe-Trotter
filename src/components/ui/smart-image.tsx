'use client'

import * as React from 'react'
import Image, { type ImageProps } from 'next/image'
import { cn, hashIndex } from '@/lib/utils'

const GRADIENTS = [
  'linear-gradient(135deg, #1F4B3F, #3E7C6A)',
  'linear-gradient(135deg, #E0642B, #C9A227)',
  'linear-gradient(135deg, #14332B, #1F4B3F)',
  'linear-gradient(135deg, #6B7280, #14181F)',
  'linear-gradient(135deg, #B74D1E, #E0642B)',
  'linear-gradient(135deg, #3E7C6A, #DCE8E4)',
]

export interface SmartImageProps extends Omit<ImageProps, 'onError' | 'src'> {
  src?: string | null
  caption: string
}

/** A dead Unsplash URL is a normal event, not an exception — the fallback must look composed. */
export function SmartImage({ src, caption, className, alt, fill, ...props }: SmartImageProps) {
  const [failed, setFailed] = React.useState(!src)
  const gradient = GRADIENTS[hashIndex(caption, GRADIENTS.length)]

  if (failed || !src) {
    return (
      <div
        className={cn('flex items-center justify-center text-center', className)}
        style={{ background: gradient, position: fill ? 'absolute' : undefined, inset: fill ? 0 : undefined }}
        role="img"
        aria-label={alt || caption}
      >
        <span className="display px-3 text-sm font-semibold text-white/90">{caption}</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt || caption}
      fill={fill}
      className={className}
      onError={() => setFailed(true)}
      {...props}
    />
  )
}
