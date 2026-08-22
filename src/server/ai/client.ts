import 'server-only'
import Groq from 'groq-sdk'

/**
 * Groq inference client.
 *
 * `server-only` above is load-bearing: it turns any accidental import from a
 * client component into a build error, which is the only thing standing between
 * the API key and a public JS bundle.
 */

const globalForGroq = globalThis as unknown as { groq?: Groq }

/** Model ids verified against GET https://api.groq.com/openai/v1/models. */
export const MODELS = {
  /** Multi-constraint catalogue selection. Needs reliable tool-calling. */
  itinerary: 'openai/gpt-oss-120b',
  /** Structured extraction. Latency matters more than depth. */
  packing: 'openai/gpt-oss-20b',
  /** Streaming conversation. Responsiveness is the whole experience. */
  chat: 'openai/gpt-oss-20b',
} as const

export const TIMEOUT_MS = { generate: 30_000, stream: 45_000 } as const

export function isAiConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}

/**
 * Throws only if a caller reaches inference without checking `isAiConfigured()`
 * first. Every user-facing surface checks, so a missing key degrades to a
 * disabled state rather than a 500.
 */
export function groq(): Groq {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured')

  globalForGroq.groq ??= new Groq({ apiKey, maxRetries: 0 })
  return globalForGroq.groq
}

interface GroqHttpError {
  status?: number
}

/**
 * Retry 429 and 5xx only. A 400 means our own prompt or schema is wrong —
 * retrying it just burns quota to get the same failure.
 */
function isRetryable(error: unknown): boolean {
  const status = (error as GroqHttpError)?.status
  return status === 429 || (typeof status === 'number' && status >= 500)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Bounded retry with exponential backoff. Two retries, then surface the error. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === attempts - 1) break
      await sleep(2 ** attempt * 500)
    }
  }
  throw lastError
}
