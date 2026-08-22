'use client'

import { useState, useTransition, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera } from 'lucide-react'
import { registerSchema, type RegisterInput } from '@/lib/validators'
import { register as registerAction } from '@/server/actions/auth'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'

export function RegisterForm() {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const firstName = watch('firstName') || ''
  const lastName = watch('lastName') || ''

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2_000_000) {
      setServerError('Photo is too large — please use an image under 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setPhotoUrl(url)
      setValue('photoUrl', url)
    }
    reader.readAsDataURL(file)
  }

  function onSubmit(data: RegisterInput) {
    setServerError(null)
    startTransition(async () => {
      const result = await registerAction(data)
      if (result && !result.ok) setServerError(result.error)
    })
  }

  return (
    <Card className="animate-rise">
      <CardHeader className="items-center text-center">
        <h1 className="display text-2xl text-[var(--ink)]">Create your account</h1>
        <p className="text-sm text-[var(--muted)]">Start planning your next trip.</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative"
              aria-label="Upload profile photo"
            >
              <Avatar src={photoUrl} firstName={firstName || '?'} lastName={lastName} size="lg" />
              <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[var(--stamp)] text-white">
                <Camera className="size-3.5" />
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First Name" htmlFor="firstName" error={errors.firstName?.message}>
              <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
            </Field>
            <Field label="Last Name" htmlFor="lastName" error={errors.lastName?.message}>
              <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
            </Field>
            <Field label="Email Address" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
            </Field>
            <Field label="Phone Number" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
            </Field>
            <Field label="City" htmlFor="city" error={errors.city?.message}>
              <Input id="city" autoComplete="address-level2" {...register('city')} />
            </Field>
            <Field label="Country" htmlFor="country" error={errors.country?.message}>
              <Input id="country" autoComplete="country-name" {...register('country')} />
            </Field>
          </div>

          <Field label="Additional Information ...." htmlFor="bio" error={errors.bio?.message}>
            <Textarea id="bio" rows={3} placeholder="Tell us about your travel style" {...register('bio')} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            </Field>
            <Field label="Confirm Password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
            </Field>
          </div>

          {serverError && <p className="text-center text-sm text-red-600">{serverError}</p>}

          <Button type="submit" loading={pending} className="mx-auto mt-2 w-full sm:w-auto sm:px-10">
            Register Users
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
