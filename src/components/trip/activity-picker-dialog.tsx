'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatDuration } from '@/lib/budget'
import type { ActivityCardDTO } from '@/server/queries/types'

export function ActivityPickerDialog({
  open,
  onOpenChange,
  activities,
  dayOptions,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activities: ActivityCardDTO[]
  dayOptions: { dayIndex: number; label: string }[]
  onAdd: (activityId: string, dayIndex: number, startTime?: string) => void
}) {
  const [dayIndex, setDayIndex] = useState(dayOptions[0]?.dayIndex ?? 0)
  const [startTime, setStartTime] = useState('09:00')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an activity</DialogTitle>
        </DialogHeader>

        <div className="flex gap-3">
          <Select value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))} className="w-40">
            {dayOptions.map((d) => (
              <option key={d.dayIndex} value={d.dayIndex}>
                {d.label}
              </option>
            ))}
          </Select>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-32" />
        </div>

        <div className="max-h-96 overflow-y-auto">
          <div className="flex flex-col gap-2">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--rule)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">{a.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <Badge variant="neutral">{a.type}</Badge>
                    <span className="num">{formatMoney(a.avgCost)}</span>
                    <span className="num">{formatDuration(a.durationMin)}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onAdd(a.id, dayIndex, startTime)
                    onOpenChange(false)
                  }}
                >
                  Add
                </Button>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--muted)]">No activities in this city yet.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
