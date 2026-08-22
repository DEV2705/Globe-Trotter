'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { generateTripFromPrompt } from '@/server/actions/ai'
import { generateItinerarySchema, ACTIVITY_TYPES, PACE } from '@/server/ai/schemas'
import type { z } from 'zod'

type FormValues = z.input<typeof generateItinerarySchema>

const INTEREST_LABELS: Record<string, string> = {
  SIGHTSEEING: 'Sightseeing',
  FOOD: 'Food',
  ADVENTURE: 'Adventure',
  CULTURE: 'Culture',
  NATURE: 'Nature',
  NIGHTLIFE: 'Nightlife',
  RELAX: 'Relax',
  SHOPPING: 'Shopping',
}

const PACE_LABELS: Record<string, string> = {
  relaxed: 'Relaxed — 2 a day',
  balanced: 'Balanced — 3 a day',
  packed: 'Packed — 4 a day',
}

/** Staged copy so a multi-second generation does not look frozen. */
const STAGES = ['Reading your request…', 'Choosing cities…', 'Selecting activities…', 'Fitting your budget…']

export function AiGenerateForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [stage, setStage] = useState(0)
  const [interests, setInterests] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(generateItinerarySchema),
    defaultValues: { currency: 'INR', pace: 'balanced', days: 7 },
  })

  function toggleInterest(type: string) {
    setInterests((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  function onSubmit(values: FormValues) {
    let tick = 0
    const timer = setInterval(() => {
      tick = Math.min(tick + 1, STAGES.length - 1)
      setStage(tick)
    }, 1400)

    startTransition(async () => {
      try {
        const result = await generateTripFromPrompt({ ...values, interests })
        if (result.ok) {
          for (const notice of result.data.notices) toast.info(notice)
          toast.success('Itinerary ready — edit anything you like.')
          router.push(`/trips/${result.data.id}/build`)
        } else {
          toast.error(result.error)
        }
      } finally {
        clearInterval(timer)
        setStage(0)
      }
    })
  }

  if (disabled) {
    return (
      <div className="rounded-md border border-dashed border-[var(--rule)] p-6 text-center">
        <Sparkles className="mx-auto mb-2 size-5 text-[var(--muted)]" />
        <p className="text-sm font-medium text-[var(--ink)]">Trip generation is unavailable</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          This server has no inference key configured. You can still plan a trip by hand.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <Field label="Where do you want to go?" htmlFor="destination" error={errors.destination?.message}>
        <Input
          id="destination"
          placeholder="Southeast Asia, or Japan, or Bali and Singapore"
          {...register('destination')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Start date" htmlFor="startDate" error={errors.startDate?.message}>
          <Input id="startDate" type="date" {...register('startDate')} />
        </Field>
        <Field label="Days" htmlFor="days" error={errors.days?.message}>
          <Input id="days" type="number" min={1} max={30} {...register('days')} />
        </Field>
        <Field label="Pace" htmlFor="pace">
          <Select id="pace" {...register('pace')}>
            {PACE.map((p) => (
              <option key={p} value={p}>
                {PACE_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">What are you into?</label>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map((type) => {
            const active = interests.includes(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleInterest(type)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-[var(--stamp)] bg-[var(--stamp)] text-white'
                    : 'border-[var(--rule)] text-[var(--muted)] hover:bg-[var(--stamp-50)]'
                )}
              >
                {INTEREST_LABELS[type]}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          Optional — these steer the suggestions rather than restrict them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Budget for activities (optional)" htmlFor="budgetCap" error={errors.budgetCap?.message}>
          <Input id="budgetCap" type="number" min={0} step={500} placeholder="40000" {...register('budgetCap')} />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <Select id="currency" {...register('currency')}>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          <Wand2 className="size-4" /> Generate itinerary
        </Button>
        {pending && <span className="num text-xs text-[var(--muted)]">{STAGES[stage]}</span>}
      </div>
    </form>
  )
}
