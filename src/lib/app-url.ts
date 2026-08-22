/**
 * Absolute base URL for links that leave the app — public share URLs and OG tags.
 *
 * Order matters. An explicitly configured URL always wins, because a custom
 * domain is what should appear in a shared link. Vercel's own hostnames are the
 * fallback so preview and first-deploy share links resolve correctly without any
 * configuration at all.
 */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  // Stable across deployments, unlike VERCEL_URL which changes per build.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (production) return `https://${production}`

  // Per-deployment hostname — correct for preview branches.
  const deployment = process.env.VERCEL_URL
  if (deployment) return `https://${deployment}`

  return 'http://localhost:3000'
}
