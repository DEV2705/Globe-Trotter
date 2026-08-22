import { db } from '@/server/db'
import { toDateInput, utcDay } from '@/lib/dates'
import type { PostDTO } from './types'

export interface GetPostsParams {
  q?: string
  tag?: string
  groupBy?: 'none' | 'tag'
  sort?: 'recent' | 'likes'
}

export async function getPosts(params: GetPostsParams = {}): Promise<PostDTO[]> {
  const { q, tag, sort = 'recent' } = params

  const posts = await db.post.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { body: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    },
    include: {
      user: { select: { firstName: true, lastName: true, photoUrl: true } },
      trip: { select: { name: true } },
    },
    orderBy: sort === 'likes' ? { likes: 'desc' } : { createdAt: 'desc' },
  })

  return posts.map((p) => ({
    id: p.id,
    userId: p.userId,
    authorName: `${p.user.firstName} ${p.user.lastName}`,
    authorPhotoUrl: p.user.photoUrl,
    tripId: p.tripId,
    tripName: p.trip?.name ?? null,
    title: p.title,
    body: p.body,
    imageUrl: p.imageUrl,
    tags: p.tags,
    likes: p.likes,
    createdAt: toDateInput(utcDay(p.createdAt)),
  }))
}

export async function getPostTags(): Promise<{ tag: string; count: number }[]> {
  const posts = await db.post.findMany({ select: { tags: true } })
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)
}
