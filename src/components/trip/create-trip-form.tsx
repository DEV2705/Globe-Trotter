'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { parseDateInput, tripLength } from '@/lib/dates'
import { tripSchema, type TripInput } from '@/lib/validators'
import { createTrip } from '@/server/actions/trips'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { SmartImage } from '@/components/ui/smart-image'
import type { CityOption } from '@/server/queries/catalog'

/** Spend per cost-index point per day — a rough starting figure the traveller edits. */
const PER_POINT_PER_DAY: Record<string, number> = { INR: 200, USD: 2.5, EUR: 2.3, GBP: 2 }
const ROUND_TO: Record<string, number> = { INR: 500, USD: 10, EUR: 10, GBP: 10 }

function suggestBudget(costIndex: number, currency: string, days: number): number | null {
  const rate = PER_POINT_PER_DAY[currency]
  if (!rate || days < 1) return null
  const step = ROUND_TO[currency] ?? 10
  return Math.max(step, Math.round((costIndex * rate * days) / step) * step)
}

export function CreateTripForm({ cityOptions }: { cityOptions: CityOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [placeQuery, setPlaceQuery] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined)
  // A city-derived cover may be swapped when the traveller picks a different city; an
  // uploaded one is theirs and must never be overwritten.
  const [coverSource, setCoverSource] = useState<'none' | 'city' | 'upload'>('none')
  const [budgetHint, setBudgetHint] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TripInput>({ resolver: zodResolver(tripSchema), defaultValues: { currency: 'INR' } })

  const selectedCityId = watch('firstCityId')

  const matches = useMemo(() => {
    const q = placeQuery.trim().toLowerCase()
    const base = q
      ? cityOptions.filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      : cityOptions.slice(0, 8)
    return base.slice(0, 8)
  }, [placeQuery, cityOptions])

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2_800_000) {
      toast.error('Cover photo is too large — please use an image under ~2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setCoverUrl(url)
      setCoverSource('upload')
      setValue('coverUrl', url)
    }
    reader.readAsDataURL(file)
  }

  /**
   * Picking a place fills in the trip for you. Every field is filled only when it is still
   * blank, so anything already typed survives; clicking the active tile clears the choice.
   */
  function selectCity(c: CityOption) {
    if (selectedCityId === c.id) {
      setValue('firstCityId', '')
      return
    }
    setValue('firstCityId', c.id)

    if (!watch('name')?.trim()) setValue('name', `Trip to ${c.name}`)
    if (!watch('description')?.trim()) {
      setValue('description', `Exploring ${c.name}, ${c.country} — ${c.region}.`)
    }

    if (coverSource !== 'upload' && c.imageUrl) {
      setCoverUrl(c.imageUrl)
      setCoverSource('city')
      setValue('coverUrl', c.imageUrl)
    }

    const start = watch('startDate')
    const end = watch('endDate')
    const currency = watch('currency') || 'INR'
    if (!watch('budgetCap') && start && end) {
      const days = tripLength(parseDateInput(start), parseDateInput(end))
      const suggested = suggestBudget(c.costIndex, currency, days)
      if (suggested) {
        setValue('budgetCap', suggested)
        setBudgetHint(`Suggested from ${c.name}'s cost index — edit freely.`)
      }
    }
  }

  function onSubmit(data: TripInput) {
    startTransition(async () => {
      const result = await createTrip(data)
      if (result.ok) {
        toast.success('Trip saved')
        router.push(`/trips/${result.data.id}/build`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start Date:" htmlFor="startDate" error={errors.startDate?.message}>
          <Input id="startDate" type="date" {...register('startDate')} />
        </Field>
        <Field label="End Date:" htmlFor="endDate" error={errors.endDate?.message}>
          <Input id="endDate" type="date" {...register('endDate')} />
        </Field>
      </div>

      <Field label="Trip name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="14 Days Across Southeast Asia" {...register('name')} />
      </Field>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Select a Place :</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={placeQuery}
            onChange={(e) => setPlaceQuery(e.target.value)}
            placeholder="Search a city..."
            className="pl-9"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {matches.map((c) => {
            const active = selectedCityId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCity(c)}
                aria-pressed={active}
                className={cn(
                  'overflow-hidden rounded-md border text-left text-xs transition-colors',
                  active ? 'border-[var(--stamp)] bg-[var(--stamp-50)]' : 'border-[var(--rule)] hover:bg-[var(--stamp-50)]'
                )}
              >
                <div className="relative h-20 w-full">
                  <SmartImage src={c.imageUrl} caption={c.name} fill className="object-cover" sizes="180px" />
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-white/90 shadow-sm">
                      <Check className="size-3.5 text-[var(--stamp)]" />
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="truncate font-medium text-[var(--ink)]">{c.name}</span>
                  <span className="truncate text-[var(--muted)]">{c.country}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Description" htmlFor="description" error={errors.description?.message}>
        <Textarea id="description" rows={3} {...register('description')} />
      </Field>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Cover photo (optional)</label>
        <div className="flex items-center gap-3">
          {coverUrl && (
            <div className="relative h-14 w-20 overflow-hidden rounded-md">
              {/* key: SmartImage latches its failed state on mount, so a new source needs a
                  fresh instance — otherwise one dead city URL would blank later covers. */}
              <SmartImage
                key={coverUrl}
                src={coverUrl}
                caption="Cover"
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Camera className="size-4" /> Upload
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onCoverChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Budget cap (optional)"
          htmlFor="budgetCap"
          error={errors.budgetCap?.message}
          hint={budgetHint ?? undefined}
        >
          <Input id="budgetCap" type="number" min={0} step={100} {...register('budgetCap')} />
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

      <Button type="submit" loading={pending} className="self-start">
        Save trip
      </Button>
    </form>
  )
}
