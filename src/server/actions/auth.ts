'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import {
  hashPassword,
  verifyPassword,
  signToken,
  setSessionCookie,
  clearSessionCookie,
  requireUser,
  landingPathFor,
} from '@/server/auth'
import { loginSchema, profileSchema, registerSchema } from '@/lib/validators'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Login returns the same error text for an unknown email and a wrong password — never enumerate accounts.
const GENERIC_LOGIN_ERROR = 'Incorrect email or password.'
const MAX_PHOTO_BASE64_LENGTH = 2_800_000 // ~2MB decoded

function assertPhotoSize(photoUrl: string | undefined): string | null {
  if (photoUrl && photoUrl.length > MAX_PHOTO_BASE64_LENGTH) {
    return 'Photo is too large — please use an image under 2MB.'
  }
  return null
}

/** Null when there is no usable `next` — the caller decides the landing path. */
function safeInternalPath(next: string | undefined): string | null {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return null
}

export const register = guard(async (input: unknown): Promise<ActionResult<undefined>> => {
  // Validate before metering. Counting rejected input means a mistyped password
  // or a mismatched confirmation burns the caller's quota, which locked people
  // out of signing up entirely after a few honest typos.
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  const photoError = assertPhotoSize(data.photoUrl)
  if (photoError) return err(photoError, { photoUrl: photoError })

  const ip = await getClientIp()
  const rateCheck = checkRateLimit('register', ip, 10, 900_000) // 10 per 15 minutes
  if (!rateCheck.success) {
    const minutes = Math.max(1, Math.ceil(rateCheck.resetMs / 60_000))
    return err(`Too many sign-up attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`)
  }

  const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true } })
  if (existing) {
    return err('An account with this email already exists.', {
      email: 'An account with this email already exists.',
    })
  }

  const password = await hashPassword(data.password)
  const user = await db.user.create({
    data: {
      email: data.email,
      password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      city: data.city,
      country: data.country,
      bio: data.bio,
      photoUrl: data.photoUrl,
    },
    select: { id: true, isAdmin: true },
  })

  const token = await signToken({ userId: user.id })
  await setSessionCookie(token)
  redirect(landingPathFor(user))
})

export const login = guard(
  async (input: unknown, next?: string): Promise<ActionResult<undefined>> => {
    const parsed = loginSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const { email, password } = parsed.data

    // Metered per email rather than per IP: several people behind one address
    // (a venue, a proxy, localhost) must not lock each other out.
    const ip = await getClientIp()
    const rateCheck = checkRateLimit('login', `${ip}:${email}`, 10, 60_000)
    if (!rateCheck.success) {
      return err('Too many failed login attempts. Please try again in a minute.')
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, password: true, isActive: true, isAdmin: true },
    })
    if (!user || !user.isActive) return err(GENERIC_LOGIN_ERROR)

    const valid = await verifyPassword(password, user.password)
    if (!valid) return err(GENERIC_LOGIN_ERROR)

    const token = await signToken({ userId: user.id })
    await setSessionCookie(token)
    redirect(safeInternalPath(next) ?? landingPathFor(user))
  }
)

export const logout = guard(async (): Promise<ActionResult<undefined>> => {
  await clearSessionCookie()
  redirect('/login')
})

export const updateProfile = guard(async (input: unknown): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  const photoError = assertPhotoSize(data.photoUrl)
  if (photoError) return err(photoError, { photoUrl: photoError })

  await db.user.update({
    where: { id: session.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      city: data.city,
      country: data.country,
      bio: data.bio,
      photoUrl: data.photoUrl,
      language: data.language,
    },
  })

  revalidatePath('/profile')
  return ok()
})

export const deleteAccount = guard(async (): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  await db.user.delete({ where: { id: session.id } })
  await clearSessionCookie()
  redirect('/login')
})

export const toggleSavedCity = guard(
  async (cityId: string): Promise<ActionResult<{ saved: boolean }>> => {
    const session = await requireUser()
    const key = { userId_cityId: { userId: session.id, cityId } }

    const existing = await db.savedCity.findUnique({ where: key })
    if (existing) {
      await db.savedCity.delete({ where: key })
    } else {
      await db.savedCity.create({ data: { userId: session.id, cityId } })
    }

    revalidatePath('/dashboard')
    revalidatePath('/explore')
    revalidatePath('/profile')
    return ok({ saved: !existing })
  }
)
