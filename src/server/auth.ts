import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { db } from '@/server/db'
import { SESSION_COOKIE } from '@/server/session-cookie'

export { SESSION_COOKIE }
const BCRYPT_COST = 10
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function secretKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  userId: string
}

export interface Session {
  id: string
  email: string
  firstName: string
  lastName: string
  photoUrl: string | null
  isAdmin: boolean
  language: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey())
}

/** The "cheap half": structurally valid and unexpired. Cannot reach Postgres — safe at the edge. */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (typeof payload.userId !== 'string') return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * The "authoritative half": does this user still exist, are they still active. Memoized with React `cache`
 * so layout, page, and subcomponents share a single DB fetch per render.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      isAdmin: true,
      isActive: true,
      language: true,
    },
  })
  if (!user || !user.isActive) return null

  const { isActive: _isActive, ...session } = user
  return session
})

/**
 * Where a signed-in user belongs after landing on `/`. Middleware runs at the edge and
 * cannot read `isAdmin` from Postgres, so it bounces through `/` and this decides.
 */
export function landingPathFor(user: { isAdmin: boolean }): string {
  return user.isAdmin ? '/admin' : '/dashboard'
}

export async function requireUser(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/** 404, not 403 — the route must not advertise that it exists. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser()
  if (!session.isAdmin) notFound()
  return session
}

function assertOwner(actualUserId: string, userId: string): void {
  if (actualUserId !== userId) throw new Error('Not found')
}

export function assertTripOwner(trip: { userId: string }, userId: string): void {
  assertOwner(trip.userId, userId)
}

export function assertStopOwner(stop: { trip: { userId: string } }, userId: string): void {
  assertOwner(stop.trip.userId, userId)
}

export function assertTripActivityOwner(
  item: { stop: { trip: { userId: string } } },
  userId: string
): void {
  assertOwner(item.stop.trip.userId, userId)
}
