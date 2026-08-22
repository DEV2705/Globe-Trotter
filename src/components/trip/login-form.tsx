'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Compass, Eye, EyeOff } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/validators'
import { login } from '@/server/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  function onSubmit(data: LoginInput) {
    setServerError(null)
    startTransition(async () => {
      const result = await login(data, next)
      if (result && !result.ok) setServerError(result.error)
    })
  }

  return (
    <Card className="animate-rise">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--stamp-50)] text-[var(--stamp)]">
          <Compass className="size-6" aria-hidden />
        </div>
        <h1 className="display text-2xl text-[var(--ink)]">Welcome back</h1>
        <p className="text-sm text-[var(--muted)]">Log in to keep planning.</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field label="Username" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <Button type="submit" loading={pending} className="mt-2 w-full">
            Login
          </Button>
        </form>
        <div className="mt-4 flex flex-col items-center gap-1 text-sm text-[var(--muted)]">
          <Link href="/register" className="hover:text-[var(--ink)]">
            Don&apos;t have an account? Register
          </Link>
          <Link href="/login" className="hover:text-[var(--ink)]">
            Forgot password?
          </Link>
        </div>
      </CardBody>
    </Card>
  )
}
