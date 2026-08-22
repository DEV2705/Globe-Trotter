'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
  /** Selecting this value deletes the param rather than setting it. */
  clearValue?: string
}

export interface SearchFilterBarProps {
  searchPlaceholder?: string
  searchKey?: string
  groupBy?: FilterGroup
  filters?: FilterGroup[]
  sort?: FilterGroup
}

/**
 * Built once, reused on Screens 3, 6, 8, 9, 10, 11, 12 (§5.6). All four controls write to URL
 * search params — state is shareable and the back button is correct.
 */
export function SearchFilterBar({
  searchPlaceholder = 'Search bar ......',
  searchKey = 'q',
  groupBy,
  filters = [],
  sort,
}: SearchFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const [query, setQuery] = React.useState(searchParams.get(searchKey) ?? '')

  React.useEffect(() => {
    setQuery(searchParams.get(searchKey) ?? '')
    // Only re-sync when the URL changes externally (e.g. back button).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString])

  React.useEffect(() => {
    const handle = setTimeout(() => {
      const current = new URLSearchParams(searchParamsString).get(searchKey) ?? ''
      if (query === current) return
      const params = new URLSearchParams(searchParamsString)
      if (query) params.set(searchKey, query)
      else params.delete(searchKey)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, 320)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function setParam(key: string, value: string, clearValue?: string) {
    const params = new URLSearchParams(searchParamsString)
    if (clearValue !== undefined && value === clearValue) params.delete(key)
    else params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const activeFilterCount = filters.filter((f) => {
    const val = searchParams.get(f.key)
    return !!val && val !== f.clearValue
  }).length

  const groupByActive = !!groupBy && !!searchParams.get(groupBy.key) && searchParams.get(groupBy.key) !== groupBy.clearValue
  const sortActive = !!sort && !!searchParams.get(sort.key) && searchParams.get(sort.key) !== sort.clearValue
  const hasAnyActive = !!searchParams.get(searchKey) || activeFilterCount > 0 || groupByActive || sortActive

  function resetAll() {
    const params = new URLSearchParams(searchParamsString)
    params.delete(searchKey)
    if (groupBy) params.delete(groupBy.key)
    for (const f of filters) params.delete(f.key)
    if (sort) params.delete(sort.key)
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
          aria-label="Search"
        />
      </div>

      {groupBy && (
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="outline" size="sm">
              {groupBy.label}
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>{groupBy.label}</DropdownLabel>
            {groupBy.options.map((opt) => (
              <DropdownItem key={opt.value} onSelect={() => setParam(groupBy.key, opt.value, groupBy.clearValue)}>
                {opt.label}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      )}

      {filters.length > 0 && (
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <SlidersHorizontal className="size-4" /> Filter
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--transit)] text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownTrigger>
          <DropdownContent className="w-56">
            {filters.map((group, i) => (
              <React.Fragment key={group.key}>
                {i > 0 && <DropdownSeparator />}
                <DropdownLabel>{group.label}</DropdownLabel>
                {group.options.map((opt) => (
                  <DropdownItem key={opt.value} onSelect={() => setParam(group.key, opt.value, group.clearValue)}>
                    {opt.label}
                  </DropdownItem>
                ))}
              </React.Fragment>
            ))}
          </DropdownContent>
        </Dropdown>
      )}

      {sort && (
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="outline" size="sm">
              {sort.label}
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>{sort.label}</DropdownLabel>
            {sort.options.map((opt) => (
              <DropdownItem key={opt.value} onSelect={() => setParam(sort.key, opt.value, sort.clearValue)}>
                {opt.label}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      )}

      {hasAnyActive && (
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <X className="size-3" /> Reset
        </button>
      )}
    </div>
  )
}
