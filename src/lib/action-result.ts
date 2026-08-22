import type { ZodError } from 'zod'

export type ActionOk<T> = { ok: true; data: T }
export type ActionErr = { ok: false; error: string; fields?: Record<string, string> }
export type ActionResult<T = undefined> = ActionOk<T> | ActionErr

export function ok<T>(data: T): ActionOk<T>
export function ok(): ActionOk<undefined>
export function ok<T>(data?: T): ActionOk<T | undefined> {
  return { ok: true, data }
}

export function err(message: string, fields?: Record<string, string>): ActionErr {
  return { ok: false, error: message, fields }
}

export function fromZod(error: ZodError): ActionErr {
  const flat = error.flatten().fieldErrors
  const fields: Record<string, string> = {}
  let headline: string | undefined

  for (const [path, messages] of Object.entries(flat)) {
    const first = messages?.[0]
    if (!first) continue
    fields[path] = first
    if (!headline) headline = first
  }

  return err(headline ?? 'Invalid input.', fields)
}

const NEXT_CONTROL_FLOW_DIGESTS = ['NEXT_REDIRECT', 'NEXT_NOT_FOUND']

function isNextControlFlowSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && NEXT_CONTROL_FLOW_DIGESTS.some((d) => digest.startsWith(d))
}

/** Wraps a server action body so an unexpected throw becomes a clean `err`, while letting
 * Next.js control-flow signals (redirect/notFound) pass through untouched. */
export function guard<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<ActionResult<T>>
) {
  return async (...args: Args): Promise<ActionResult<T>> => {
    try {
      return await fn(...args)
    } catch (error) {
      if (isNextControlFlowSignal(error)) throw error
      console.error(error)
      return err('Something went wrong. Please try again.')
    }
  }
}
