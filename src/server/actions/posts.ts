'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { requireUser } from '@/server/auth'
import { postSchema } from '@/lib/validators'
import { ok, err, fromZod, guard, type ActionResult } from '@/lib/action-result'

export const createPost = guard(async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  const session = await requireUser()
  const parsed = postSchema.safeParse(input)
  if (!parsed.success) return fromZod(parsed.error)
  const data = parsed.data

  // A post may only link a trip the author owns.
  if (data.tripId) {
    const trip = await db.trip.findUnique({ where: { id: data.tripId }, select: { userId: true } })
    if (!trip || trip.userId !== session.id) {
      return err('You can only link a trip you own.', { tripId: 'You can only link a trip you own.' })
    }
  }

  const post = await db.post.create({
    data: {
      userId: session.id,
      tripId: data.tripId ?? null,
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl,
      tags: data.tags,
    },
    select: { id: true },
  })

  revalidatePath('/community')
  return ok({ id: post.id })
})

export const likePost = guard(async (postId: string): Promise<ActionResult<undefined>> => {
  await requireUser()
  await db.post.update({ where: { id: postId }, data: { likes: { increment: 1 } } })
  revalidatePath('/community')
  return ok()
})

export const deletePost = guard(async (postId: string): Promise<ActionResult<undefined>> => {
  const session = await requireUser()
  const post = await db.post.findUnique({ where: { id: postId }, select: { userId: true } })
  if (!post) notFound()
  if (post.userId !== session.id) throw new Error('Not found')

  await db.post.delete({ where: { id: postId } })

  revalidatePath('/community')
  return ok()
})
