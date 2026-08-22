'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney, formatMoneyShort } from '@/lib/budget'
import type { BudgetSummary } from '@/lib/budget'

export function BudgetByDayBar({ byDay, currency }: { byDay: BudgetSummary['byDay']; currency: string }) {
  if (byDay.length === 0) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">No days to show yet.</p>
  }

  const data = byDay.map((d) => ({ ...d, label: `D${d.dayIndex + 1}` }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => formatMoneyShort(v, currency)}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value: number) => formatMoney(value, currency)}
          labelFormatter={(label) => `Day ${String(label).replace('D', '')}`}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.dayIndex} fill={d.overCap ? 'var(--transit)' : 'var(--stamp)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
