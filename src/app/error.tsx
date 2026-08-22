'use client'

import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--paper)] px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--transit-50)] text-[var(--transit)]">
        <TriangleAlert className="size-7" aria-hidden />
      </div>
      <h1 className="display text-2xl text-[var(--ink)]">Something went wrong</h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        The plan didn&apos;t load. Try again — nothing has been lost.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
