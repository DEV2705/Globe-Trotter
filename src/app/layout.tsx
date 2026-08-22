import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Toaster } from '@/components/shell/toaster'
import './globals.css'

export const metadata: Metadata = {
  title: 'GlobeTrotter — plan the whole trip',
  description: 'Multi-city travel planning: itineraries, budgets, and a shareable public plan.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts are <link>-ed, never bundled — a build must never depend on a third-party fetch (§3.7). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
