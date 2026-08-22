'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteAccount } from '@/server/actions/auth'

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteAccount()
      if (result && !result.ok) toast.error(result.error)
    })
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="This permanently deletes your account and every trip you've created. This cannot be undone."
        confirmLabel="Delete account"
        loading={pending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
