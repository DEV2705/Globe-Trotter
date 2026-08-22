'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Plus } from 'lucide-react'
import { postSchema } from '@/lib/validators'
import { createPost } from '@/server/actions/posts'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TripOption } from '@/server/queries/types'

export function PostComposer({ tripOptions }: { tripOptions: TripOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [tripId, setTripId] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  function submit() {
    const parsed = postSchema.safeParse({ title, body, tags, tripId: tripId || undefined, imageUrl })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    startTransition(async () => {
      const result = await createPost(parsed.data)
      if (result.ok) {
        toast.success('Post shared')
        setOpen(false)
        setTitle('')
        setBody('')
        setTags('')
        setImageUrl(undefined)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Share your experience
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share your experience</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened?" />
            </Field>
            <Field label="Details">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </Field>
            <Field label="Tags (comma separated)">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="thailand, adventure" />
            </Field>
            <Field label="Link a trip (optional)">
              <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">None</option>
                {tripOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" /> Add photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
              {imageUrl && <span className="text-xs text-[var(--muted)]">Photo attached</span>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button loading={pending} onClick={submit} className="self-end">
              Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
