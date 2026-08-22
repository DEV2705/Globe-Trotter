import { headers } from 'next/headers'

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory sliding-window bucket store for rate limiting
const rateLimitStore = new Map<string, RateLimitRecord>()

// Periodically clean up expired entries to prevent memory leaks.
// unref() is load-bearing: without it this timer keeps the event loop alive, so
// any process that imports this module never exits on its own.
const sweeper = setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60_000)
sweeper.unref?.()

export async function getClientIp(): Promise<string> {
  const head = await headers()
  const forwarded = head.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim())
    return ips[0] || '127.0.0.1'
  }
  return head.get('x-real-ip') || '127.0.0.1'
}

/**
 * Enforces rate limiting per key (e.g., IP address or user ID).
 * @param actionKey Unique identifier for the operation being rate limited.
 * @param identifier Client IP or User ID.
 * @param limit Maximum allowed attempts within the window.
 * @param windowMs Window duration in milliseconds.
 * @returns { success: boolean; remaining: number; resetMs: number }
 */
export function checkRateLimit(
  actionKey: string,
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  const key = `${actionKey}:${identifier}`
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return { success: true, remaining: limit - 1, resetMs: windowMs }
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetMs: record.resetTime - now }
  }

  record.count += 1
  return { success: true, remaining: limit - record.count, resetMs: record.resetTime - now }
}
