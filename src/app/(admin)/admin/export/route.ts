import { NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { getAdminUserExport } from '@/server/queries/admin'

function csvEscape(value: string | number | boolean): string {
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export async function GET() {
  await requireAdmin()

  const rows = await getAdminUserExport()
  const header = ['id', 'email', 'firstName', 'lastName', 'isAdmin', 'isActive', 'createdAt', 'tripCount']
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [r.id, r.email, r.firstName, r.lastName, r.isAdmin, r.isActive, r.createdAt, r.tripCount].map(csvEscape).join(',')
    ),
  ]

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="globetrotter-users.csv"',
    },
  })
}
