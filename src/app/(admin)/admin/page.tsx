import { Suspense } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { requireAdmin } from '@/server/auth'
import { getAdminStats } from '@/server/queries/admin'
import { PageHeader } from '@/components/shell/page-header'
import { SearchFilterBar } from '@/components/shell/search-filter-bar'
import { Panel, Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Stat } from '@/components/ui/stat'
import { Button } from '@/components/ui/button'
import { TrendLine } from '@/components/charts/trend-line'
import { TopBarChart } from '@/components/charts/top-bar-chart'
import { AdminUserRowActions } from '@/components/trip/admin-user-row-actions'

interface AdminSearchParams {
  q?: string
  filter?: string
  sort?: string
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const session = await requireAdmin()
  const params = await searchParams

  const stats = await getAdminStats({
    q: params.q,
    filter: (params.filter as never) ?? 'all',
    sort: (params.sort as never) ?? 'recent',
  })

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Platform analytics and user management."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/export">
              <Download className="size-4" /> Export CSV
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <Stat label="Users" value={stats.totals.users} />
        </Card>
        <Card className="p-4">
          <Stat label="Trips" value={stats.totals.trips} />
        </Card>
        <Card className="p-4">
          <Stat label="Posts" value={stats.totals.posts} />
        </Card>
        <Card className="p-4">
          <Stat label="Active users" value={stats.totals.activeUsers} />
        </Card>
      </div>

      <Suspense>
        <SearchFilterBar
          searchPlaceholder="Search bar ......"
          filters={[
            {
              key: 'filter',
              label: 'Filter',
              clearValue: 'all',
              options: [
                { value: 'all', label: 'All' },
                { value: 'admins', label: 'Admins' },
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'with-trips', label: 'With trips' },
              ],
            },
          ]}
          sort={{
            key: 'sort',
            label: 'Sort by...',
            clearValue: 'recent',
            options: [
              { value: 'recent', label: 'Recent' },
              { value: 'trips-desc', label: 'Most trips' },
              { value: 'name', label: 'Name' },
            ],
          }}
        />
      </Suspense>

      <Panel
        title="Manage Users"
        description="This section is responsible for managing the users and their actions. This section will give the admin the access to view…"
        className="mb-6"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="py-2">User</th>
                <th className="py-2">Trips</th>
                <th className="py-2">Joined</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats.users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--rule)] last:border-0">
                  <td className="py-2">
                    <p className="font-medium text-[var(--ink)]">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{u.email}</p>
                  </td>
                  <td className="num py-2">{u.tripCount}</td>
                  <td className="num py-2">{u.createdAt}</td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {u.isAdmin && <Badge variant="stamp-outline">Admin</Badge>}
                      <Badge variant={u.isActive ? 'stamp' : 'neutral'}>{u.isActive ? 'Active' : 'Suspended'}</Badge>
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <AdminUserRowActions userId={u.id} isActive={u.isActive} isAdmin={u.isAdmin} isSelf={u.id === session.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Popular cities">
          <TopBarChart data={stats.topCities} dataKey="stopCount" labelKey="name" countLabel="stop" />
        </Panel>
        <Panel title="Popular Activities">
          <TopBarChart data={stats.topActivities} dataKey="addCount" labelKey="name" countLabel="add" />
        </Panel>
      </div>

      <Panel title="User Trends and Analytics" description="Signups and trips created per week, last 12 weeks.">
        <TrendLine data={stats.trendsByWeek} />
      </Panel>
    </div>
  )
}
