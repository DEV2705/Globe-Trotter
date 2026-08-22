import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/server/db'
import { getSession } from '@/server/auth'
import { isAiConfigured } from '@/server/ai/client'
import { checkRateLimit } from '@/server/ai/rate-limit'
import { streamChatReply, type ChatTurn } from '@/server/ai/chat'
import { chatRequestSchema } from '@/server/ai/schemas'

/**
 * A Route Handler rather than a Server Action: actions cannot stream a response
 * token by token, and the streaming is the point.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'The assistant is not configured on this server.' }, { status: 503 })
  }

  const limit = checkRateLimit(session.id, 'chat')
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.message }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Type a message first.' }, { status: 400 })
  }
  const { message, tripId } = parsed.data

  // Only this user's history, newest last.
  const recent = await db.chatMessage.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { role: true, content: true },
  })
  const history: ChatTurn[] = recent
    .reverse()
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

  await db.chatMessage.create({
    data: { userId: session.id, tripId: tripId ?? null, role: 'user', content: message },
  })

  let stream: ReadableStream<Uint8Array>
  let full: Promise<string>
  try {
    ;({ stream, full } = await streamChatReply(session.id, history, message, tripId))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'The assistant is unavailable right now.' }, { status: 502 })
  }

  // Persist the reply once the stream finishes, without blocking the response.
  void full
    .then((text) => {
      if (!text.trim()) return
      return db.chatMessage.create({
        data: { userId: session.id, tripId: tripId ?? null, role: 'assistant', content: text },
      })
    })
    .catch((error) => console.error(error))

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
