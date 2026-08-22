'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney } from '@/lib/budget'
import type { BudgetSummary } from '@/lib/budget'

const CATEGORY_COLORS: Record<string, string> = {
  TRANSPORT: '#1F4B3F',
  STAY: '#3E7C6A',
  ACTIVITY: '#E0642B',
  MEAL: '#C9A227',
  OTHER: '#6B7280',
}

export function BudgetPie({ byCategory, currency }: { byCategory: BudgetSummary['byCategory']; currency: string }) {
  const data = byCategory.filter((c) => c.amount > 0)

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">No spend recorded yet.</p>
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatMoney(value, currency)} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {byCategory.map((c) => (
          <li key={c.category} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c.category] }} />
            <span className="text-[var(--muted)]">{c.category}</span>
            <span className="num text-[var(--ink)]">{c.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
