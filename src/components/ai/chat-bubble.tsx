'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'Is my budget enough?',
  'What should I not miss?',
  'How is my trip looking?',
]

const OPEN_KEY = 'gt.chat.open'

export function ChatBubble({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Restore the panel state. Wrapped because storage throws outright in some
  // embedded contexts rather than just returning null.
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === '1') setOpen(true)
    } catch {
      /* no stored preference available */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0')
    } catch {
      /* preference simply will not persist */
    }
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, streaming])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // The trip being viewed, so "is my budget enough" needs no further context.
  const tripId = pathname.startsWith('/trips/') && params?.id ? params.id : undefined

  async function send(text: string) {
    const message = text.trim()
    if (!message || streaming) return

    setInput('')
    setTurns((prev) => [...prev, { role: 'user', content: message }, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, tripId }),
      })

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null)
        throw new Error(detail?.error ?? 'The assistant is unavailable right now.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setTurns((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: next[next.length - 1].content + chunk,
          }
          return next
        })
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Something went wrong.'
      setTurns((prev) => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: detail }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  if (!enabled) return null

  return (
    <>
      {/* Hidden while the panel is open — the launcher would otherwise sit on top of it. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open travel assistant"
          aria-expanded={false}
          className="no-print fixed bottom-5 left-5 z-50 flex size-14 items-center justify-center rounded-full bg-[var(--stamp)] text-white shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <MessageCircle className="size-5" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Travel assistant"
          // Dynamic viewport height, so the input stays above a mobile browser's
          // retracting toolbar rather than being pushed off-screen.
          className="no-print fixed bottom-5 left-5 z-50 flex h-[min(30rem,calc(100dvh-2.5rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--surface)] shadow-2xl"
        >
          <header className="flex items-center gap-2 border-b border-[var(--rule)] px-4 py-3">
            <Sparkles className="size-4 shrink-0 text-[var(--stamp)]" />
            <span className="display text-sm font-semibold text-[var(--ink)]">Travel assistant</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close travel assistant"
              className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.length === 0 && (
              <div className="pt-2">
                <p className="text-sm text-[var(--muted)]">
                  Ask about your trips — budgets, timings, or what to see.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => send(starter)}
                      className="rounded-md border border-[var(--rule)] px-3 py-2 text-left text-xs text-[var(--ink)] transition-colors hover:bg-[var(--stamp-50)]"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                  turn.role === 'user'
                    ? 'ml-auto bg-[var(--stamp)] text-white'
                    : 'bg-[var(--paper)] text-[var(--ink)]'
                )}
              >
                {turn.content ||
                  (streaming && i === turns.length - 1 ? (
                    <span className="inline-flex gap-1" aria-label="Thinking">
                      <span className="size-1.5 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-[var(--muted)]" />
                    </span>
                  ) : null)}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-[var(--rule)] p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your trips…"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-md border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--stamp)]"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--stamp)] text-white disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
