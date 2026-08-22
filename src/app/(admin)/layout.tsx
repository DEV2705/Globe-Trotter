import type { ReactNode } from 'react'
import { requireAdmin } from '@/server/auth'
import { AppShell } from '@/components/shell/app-shell'

// Guards every (admin) route by default. Route Handlers are not wrapped by layouts, so
// admin/export/route.ts keeps its own requireAdmin() call.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin()
  return <AppShell user={session}>{children}</AppShell>
}
