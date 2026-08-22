import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'

export default function BuildLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-8 w-72" />
      <Skeleton className="mb-6 h-4 w-96" />
      <div className="flex flex-col gap-4">
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-40" />
      </div>
    </div>
  )
}
