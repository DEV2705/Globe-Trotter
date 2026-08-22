import { Skeleton, SkeletonRail } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-40 w-full rounded-lg" />
      <Skeleton className="mb-6 h-20 w-full rounded-lg" />
      <Skeleton className="mb-3 h-6 w-48" />
      <SkeletonRail count={5} />
      <Skeleton className="mb-3 mt-8 h-6 w-48" />
      <SkeletonRail count={3} />
    </div>
  )
}
