import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'

export default function TripsLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-64" />
      <Skeleton className="mb-6 h-10 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
