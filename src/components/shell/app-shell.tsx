import type { ReactNode } from 'react'
import { TopBar, type TopBarUser } from './top-bar'

export function AppShell({ user, children }: { user: TopBarUser; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="no-print border-t border-[var(--rule)] px-4 py-6 text-center text-xs text-[var(--muted)]">
        GlobeTrotter — plan the whole trip, not just the flight.
      </footer>
    </div>
  )
}
