'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { tripSchema, type TripInput } from '@/lib/validators'
import { createTrip } from '@/server/actions/trips'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import type { CityOption } from '@/server/queries/catalog'

export function CreateTripForm({ cityOptions }: { cityOptions: CityOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [placeQuery, setPlaceQuery] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined)
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
      setValue('coverUrl', url)
    }
    reader.readAsDataURL(file)
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
                onClick={() => setValue('firstCityId', c.id)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left text-xs',
                  active ? 'border-[var(--stamp)] bg-[var(--stamp-50)]' : 'border-[var(--rule)] hover:bg-[var(--stamp-50)]'
                )}
              >
                <span className="flex w-full items-center justify-between font-medium text-[var(--ink)]">
                  {c.name}
                  {active && <Check className="size-3.5 text-[var(--stamp)]" />}
                </span>
                <span className="text-[var(--muted)]">{c.country}</span>
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
          {coverUrl && <img src={coverUrl} alt="" className="h-14 w-20 rounded-md object-cover" />}
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Camera className="size-4" /> Upload
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onCoverChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Budget cap (optional)" htmlFor="budgetCap" error={errors.budgetCap?.message}>
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
