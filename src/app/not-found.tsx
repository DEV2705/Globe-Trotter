import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--paper)] px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--stamp-50)] text-[var(--stamp)]">
        <Compass className="size-7" aria-hidden />
      </div>
      <h1 className="display text-2xl text-[var(--ink)]">Page not found</h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        This itinerary doesn&apos;t exist, or it isn&apos;t shared with you.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}
