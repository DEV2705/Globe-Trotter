'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { logout } from '@/server/actions/auth'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trips', label: 'My Trips' },
  { href: '/explore', label: 'Explore' },
  { href: '/community', label: 'Community' },
]

export interface TopBarUser {
  firstName: string
  lastName: string
  photoUrl: string | null
  isAdmin: boolean
}

export function TopBar({ user }: { user: TopBarUser }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const navItems = user.isAdmin ? [...NAV_ITEMS, { href: '/admin', label: 'Admin' }] : NAV_ITEMS
  // Plain startsWith would light up /trips for /trips-anything.
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--rule)] bg-[var(--paper)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="display text-lg font-bold text-[var(--stamp)]">
            GlobeTrotter
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]',
                  isActive(item.href) && 'text-[var(--ink)]'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/trips/new">Plan a trip</Link>
          </Button>

          <Dropdown>
            <DropdownTrigger className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stamp)]">
              <Avatar src={user.photoUrl} firstName={user.firstName} lastName={user.lastName} size="sm" />
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem asChild>
                <Link href="/profile" className="flex items-center gap-2">
                  <UserIcon className="size-4" /> Profile
                </Link>
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onSelect={() => logout()} className="flex items-center gap-2 text-red-600">
                <LogOut className="size-4" /> Log out
              </DropdownItem>
            </DropdownContent>
          </Dropdown>

          <button
            type="button"
            className="rounded-md p-2 text-[var(--ink)] md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="flex flex-col gap-1 border-t border-[var(--rule)] px-4 py-3 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'rounded-md px-2 py-2 text-sm font-medium text-[var(--muted)]',
                isActive(item.href) && 'bg-[var(--stamp-50)] text-[var(--ink)]'
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/trips/new"
            onClick={() => setMobileOpen(false)}
            className="mt-1 rounded-md bg-[var(--stamp)] px-2 py-2 text-center text-sm font-medium text-white"
          >
            Plan a trip
          </Link>
        </nav>
      )}
    </header>
  )
}
