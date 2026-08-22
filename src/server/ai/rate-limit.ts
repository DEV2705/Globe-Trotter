import 'server-only'

/**
 * Per-user hourly quotas for inference calls.
 *
 * In-process only — state lives in a Map and resets on redeploy. That is
 * sufficient for a single instance; running more than one would need Redis (or
 * any shared store) behind the same interface for the limits to mean anything.
 */

export type AiFeature = 'itinerary' | 'packing' | 'chat'

const HOURLY_LIMIT: Record<AiFeature, number> = {
  itinerary: 5,
  packing: 10,
  chat: 30,
}

const WINDOW_MS = 60 * 60 * 1000

interface Window {
  count: number
  resetAt: number
}

const globalForLimiter = globalThis as unknown as { aiWindows?: Map<string, Window> }
const windows = (globalForLimiter.aiWindows ??= new Map<string, Window>())

/** Drop windows that expired more than an hour ago so the Map cannot grow forever. */
function evictStale(now: number): void {
  if (windows.size < 500) return
  for (const [key, window] of windows) {
    if (window.resetAt + WINDOW_MS < now) windows.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Human-readable reason, present only when `allowed` is false. */
  message?: string
}

function minutesUntil(timestamp: number, now: number): number {
  return Math.max(1, Math.ceil((timestamp - now) / 60_000))
}

export function checkRateLimit(userId: string, feature: AiFeature): RateLimitResult {
  const now = Date.now()
  evictStale(now)

  const key = `${feature}:${userId}`
  const limit = HOURLY_LIMIT[feature]
  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: limit - 1 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      message: `You have used all ${limit} AI requests for this hour. Try again in ${minutesUntil(existing.resetAt, now)} minutes.`,
    }
  }

  existing.count += 1
  return { allowed: true, remaining: limit - existing.count }
}
