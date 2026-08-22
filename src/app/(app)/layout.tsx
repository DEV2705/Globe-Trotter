import type { ReactNode } from 'react'
import { requireUser } from '@/server/auth'
import { AppShell } from '@/components/shell/app-shell'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireUser()
  return <AppShell user={session}>{children}</AppShell>
}
