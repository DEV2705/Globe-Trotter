'use client'

import { useState, useTransition, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { profileSchema, type ProfileInput } from '@/lib/validators'
import { updateProfile } from '@/server/actions/auth'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'

export interface ProfileFormValues extends ProfileInput {
  email: string
}

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [pending, startTransition] = useTransition()
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initial.photoUrl)
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  })

  const firstName = watch('firstName') || initial.firstName
  const lastName = watch('lastName') || initial.lastName

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2_000_000) {
      toast.error('Photo is too large — please use an image under 2MB.')
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

  function onSubmit(data: ProfileInput) {
    startTransition(async () => {
      const result = await updateProfile(data)
      if (result.ok) toast.success('Profile saved')
      else toast.error(result.error)
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="Change photo">
          <Avatar src={photoUrl} firstName={firstName} lastName={lastName} size="lg" />
          <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[var(--stamp)] text-white">
            <Camera className="size-3.5" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First Name" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" {...register('firstName')} />
          </Field>
          <Field label="Last Name" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" {...register('lastName')} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" value={initial.email} disabled />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </Field>
          <Field label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </Field>
          <Field label="Country" htmlFor="country" error={errors.country?.message}>
            <Input id="country" {...register('country')} />
          </Field>
          <Field label="Language" htmlFor="language" error={errors.language?.message}>
            <Select id="language" {...register('language')}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="ja">Japanese</option>
            </Select>
          </Field>
        </div>
        <Field label="Bio" htmlFor="bio" error={errors.bio?.message}>
          <Textarea id="bio" rows={3} {...register('bio')} />
        </Field>
        <Button type="submit" loading={pending} className="self-start">
          Save changes
        </Button>
      </form>
    </div>
  )
}
