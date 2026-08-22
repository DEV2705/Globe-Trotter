'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SmartImage } from '@/components/ui/smart-image'
import { likePost } from '@/server/actions/posts'
import type { PostDTO } from '@/server/queries/types'

export function PostCard({ post }: { post: PostDTO }) {
  const [likes, setLikes] = useState(post.likes)
  const [, startTransition] = useTransition()
  const [name = '', ...rest] = post.authorName.split(' ')
  const lastName = rest.join(' ')

  function like() {
    setLikes((l) => l + 1)
    startTransition(async () => {
      const result = await likePost(post.id)
      if (!result.ok) {
        setLikes((l) => l - 1)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="animate-rise flex flex-col overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)]">
      {post.imageUrl && (
        <div className="relative h-36 w-full">
          <SmartImage src={post.imageUrl} caption={post.title} fill className="object-cover" sizes="360px" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Avatar src={post.authorPhotoUrl} firstName={name} lastName={lastName} size="sm" />
          <div>
            <p className="text-xs font-medium text-[var(--ink)]">{post.authorName}</p>
            <p className="text-[10px] text-[var(--muted)]">{post.createdAt}</p>
          </div>
        </div>
        <h3 className="display text-base text-[var(--ink)]">{post.title}</h3>
        <p className="line-clamp-3 text-sm text-[var(--muted)]">{post.body}</p>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <Badge key={t} variant="neutral">
                #{t}
              </Badge>
            ))}
          </div>
        )}
        {post.tripId && post.tripName && (
          <Link href={`/trips/${post.tripId}`} className="text-xs font-medium text-[var(--stamp)] hover:underline">
            View trip: {post.tripName}
          </Link>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <button onClick={like} className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--transit)]">
            <Heart className="size-4" /> <span className="num">{likes}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
