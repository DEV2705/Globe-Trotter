'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { adminToggleAdmin, adminToggleUser } from '@/server/actions/admin'

export function AdminUserRowActions({ userId, isActive, isAdmin, isSelf }: { userId: string; isActive: boolean; isAdmin: boolean; isSelf: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggleActive() {
    startTransition(async () => {
      const result = await adminToggleUser(userId)
      if (result.ok) {
        toast.success(isActive ? 'User suspended' : 'User restored')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function toggleAdmin() {
    startTransition(async () => {
      const result = await adminToggleAdmin(userId)
      if (result.ok) {
        toast.success(isAdmin ? 'Admin access removed' : 'Promoted to admin')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  if (isSelf) return <span className="text-xs text-[var(--muted)]">You</span>

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" loading={pending} onClick={toggleActive}>
        {isActive ? 'Suspend' : 'Restore'}
      </Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={toggleAdmin}>
        {isAdmin ? 'Demote' : 'Promote'}
      </Button>
    </div>
  )
}
