'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { CityOption } from '@/server/queries/catalog'

export function CityPickerDialog({
  open,
  onOpenChange,
  cityOptions,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cityOptions: CityOption[]
  onSelect: (city: CityOption) => void
}) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? cityOptions.filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      : cityOptions
    return base.slice(0, 30)
  }, [query, cityOptions])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a stop</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city..."
            className="pl-9"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c)
                  onOpenChange(false)
                  setQuery('')
                }}
                className={cn(
                  'flex flex-col items-start rounded-md border border-[var(--rule)] p-2.5 text-left text-sm hover:bg-[var(--stamp-50)]'
                )}
              >
                <span className="font-medium text-[var(--ink)]">{c.name}</span>
                <span className="text-xs text-[var(--muted)]">{c.country}</span>
              </button>
            ))}
            {matches.length === 0 && <p className="col-span-2 py-6 text-center text-sm text-[var(--muted)]">No cities found.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
