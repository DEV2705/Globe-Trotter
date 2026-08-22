import { Suspense } from 'react'
import { MessageSquare } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getPosts, getPostTags } from '@/server/queries/community'
import { getTripOptions } from '@/server/queries/trips'
import { PageHeader } from '@/components/shell/page-header'
import { SearchFilterBar } from '@/components/shell/search-filter-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { PostCard } from '@/components/trip/post-card'
import { PostComposer } from '@/components/trip/post-composer'

interface CommunitySearchParams {
  q?: string
  tag?: string
  sort?: string
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<CommunitySearchParams> }) {
  const session = await requireUser()
  const params = await searchParams

  const [posts, tags, tripOptions] = await Promise.all([
    getPosts({ q: params.q, tag: params.tag, sort: (params.sort as 'recent' | 'likes') ?? 'recent' }),
    getPostTags(),
    getTripOptions(session.id),
  ])

  return (
    <div>
      <PageHeader
        title="Community"
        description="Community section where all the users can share their experience about a certain trip or activity. Using the search, group by or filter, narrow the results."
        action={<PostComposer tripOptions={tripOptions} />}
      />

      <Suspense>
        <SearchFilterBar
          searchPlaceholder="Search bar ......"
          filters={[
            {
              key: 'tag',
              label: 'Filter',
              clearValue: '',
              options: [{ value: '', label: 'All tags' }, ...tags.map((t) => ({ value: t.tag, label: `#${t.tag} (${t.count})` }))],
            },
          ]}
          sort={{
            key: 'sort',
            label: 'Sort by...',
            clearValue: 'recent',
            options: [
              { value: 'recent', label: 'Most recent' },
              { value: 'likes', label: 'Most liked' },
            ],
          }}
        />
      </Suspense>

      {posts.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No posts yet" description="Be the first to share your trip experience." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
