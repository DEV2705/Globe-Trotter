'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AdminStats } from '@/server/queries/types'

export function TrendLine({ data }: { data: AdminStats['trendsByWeek'] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
        <Tooltip />
        <Line type="monotone" dataKey="signups" stroke="#1F4B3F" strokeWidth={2} dot={false} name="Signups" />
        <Line type="monotone" dataKey="tripsCreated" stroke="#E0642B" strokeWidth={2} dot={false} name="Trips created" />
      </LineChart>
    </ResponsiveContainer>
  )
}
