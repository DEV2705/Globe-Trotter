import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Prisma `Decimal` (or anything Decimal-shaped) -> plain number. Never let a Decimal reach a chart. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && 'toNumber' in (value as Record<string, unknown>)) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value)
}

const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz' // no 0/O/1/l/I

export function shortId(length = 5): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]
  }
  return out
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60)
}

export function hashIndex(key: string, buckets: number): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash % buckets
}

export function initials(firstName: string, lastName?: string | null): string {
  const a = firstName?.[0] ?? ''
  const b = lastName?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}
