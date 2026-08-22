'use client'

import { useState } from 'react'
import { PenLine, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/card'
import { CreateTripForm } from '@/components/trip/create-trip-form'
import { AiGenerateForm } from '@/components/trip/ai-generate-form'
import type { CityOption } from '@/server/queries/catalog'

type Mode = 'ai' | 'manual'

export function NewTripTabs({ cityOptions, aiEnabled }: { cityOptions: CityOption[]; aiEnabled: boolean }) {
  // Generation leads when it is available — it is the faster path to a real trip.
  const [mode, setMode] = useState<Mode>(aiEnabled ? 'ai' : 'manual')

  const tabs: { value: Mode; label: string; icon: typeof PenLine }[] = [
    { value: 'ai', label: 'Generate for me', icon: Sparkles },
    { value: 'manual', label: 'Build it myself', icon: PenLine },
  ]

  return (
    <div className="max-w-2xl">
      <div role="tablist" aria-label="How to create your trip" className="mb-4 flex gap-2">
        {tabs.map((tab) => {
          const active = mode === tab.value
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setMode(tab.value)}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-[var(--stamp)] bg-[var(--stamp-50)] text-[var(--ink)]'
                  : 'border-[var(--rule)] text-[var(--muted)] hover:text-[var(--ink)]'
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {mode === 'ai' ? (
        <Panel
          title="Describe your trip"
          description="Tell us the shape of it and we will build a day-by-day plan from our catalogue — every place and activity is real and fully editable afterwards."
        >
          <AiGenerateForm disabled={!aiEnabled} />
        </Panel>
      ) : (
        <Panel title="Trip details">
          <CreateTripForm cityOptions={cityOptions} />
        </Panel>
      )}
    </div>
  )
}
