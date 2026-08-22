'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireAdmin } from '@/server/auth'
import { ok, err, guard, type ActionResult } from '@/lib/action-result'

export const adminToggleUser = guard(async (userId: string): Promise<ActionResult<undefined>> => {
  const session = await requireAdmin()
  if (userId === session.id) return err('You cannot suspend your own account.')

  const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } })
  if (!user) notFound()

  await db.user.update({ where: { id: userId }, data: { isActive: !user.isActive } })
  revalidatePath('/admin')
  return ok()
})

export const adminToggleAdmin = guard(async (userId: string): Promise<ActionResult<undefined>> => {
  const session = await requireAdmin()
  if (userId === session.id) return err('You cannot change your own admin status.')

  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user) notFound()

  await db.user.update({ where: { id: userId }, data: { isAdmin: !user.isAdmin } })
  revalidatePath('/admin')
  return ok()
})

export const adminDeleteTrip = guard(async (tripId: string): Promise<ActionResult<undefined>> => {
  await requireAdmin()

  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { id: true } })
  if (!trip) notFound()

  await db.trip.delete({ where: { id: tripId } })
  revalidatePath('/admin')
  return ok()
})
