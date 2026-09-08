import { type ComponentType, useEffect, useRef, useState } from 'react';
import {
	Building2,
	ChartLine,
	ClipboardList,
	Handshake,
	LayoutGrid,
	Menu,
	NotebookPen,
	PanelLeftClose,
	PanelLeftOpen,
	Search,
	Settings,
	Shield,
	Users,
} from 'lucide-react';
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from "@/src/lib/auth/useAuth";
import { ApiError, apiRequest } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { QuickAddDialog } from "@/src/components/wip/app/quick-add-dialog";
import { Button } from "@/src/components/wip/layout/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/src/components/wip/layout/ui/dropdown-menu";
import { Input } from "@/src/components/wip/layout/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/src/components/wip/layout/ui/sheet";

type NavigationItem = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/deals', label: 'Deals', icon: Handshake },
  { to: '/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/activity', label: 'Notes / activity', icon: NotebookPen },
  { to: '/admin', label: 'Admin', icon: Shield },
  { to: '/reports', label: 'Reports', icon: ChartLine },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const PAGE_TITLES: Array<{ pattern: string; title: string }> = [
  { pattern: '/', title: 'Dashboard' },
  { pattern: '/contacts', title: 'Contacts' },
  { pattern: '/contacts/:contactId', title: 'Contact details' },
  { pattern: '/companies', title: 'Companies' },
  { pattern: '/companies/:companyId', title: 'Company details' },
  { pattern: '/deals', title: 'Deals' },
  { pattern: '/deals/:dealId', title: 'Deal details' },
  { pattern: '/tasks', title: 'Tasks' },
  { pattern: '/activity', title: 'Notes / activity' },
  { pattern: '/admin', title: 'Admin control plane' },
  { pattern: '/reports', title: 'Reports' },
  { pattern: '/settings', title: 'Settings' },
]

type BreadcrumbItem = {
  label: string
  to?: string
}

type GlobalSearchResult = {
  entity_type: 'contact' | 'company' | 'deal' | string
  entity_id: string
  title: string
  subtitle: string | null
  route: string
}

const resolvePageTitle = (pathname: string) => {
  for (const entry of PAGE_TITLES) {
    if (matchPath({ path: entry.pattern, end: true }, pathname)) {
      return entry.title
    }
  }
  return 'Workspace'
}

const resolveBreadcrumbItems = (pathname: string): BreadcrumbItem[] => {
  const baseCrumbs: BreadcrumbItem[] = [{ label: 'Workspace', to: '/' }]

  const hierarchyPatterns: Array<{
    pattern: string
    current: string
    parent?: BreadcrumbItem
  }> = [
    { pattern: '/', current: 'Dashboard' },
    { pattern: '/contacts', current: 'Contacts' },
    { pattern: '/contacts/:contactId', current: 'Contact details', parent: { label: 'Contacts', to: '/contacts' } },
    { pattern: '/companies', current: 'Companies' },
    { pattern: '/companies/:companyId', current: 'Company details', parent: { label: 'Companies', to: '/companies' } },
    { pattern: '/deals', current: 'Deals' },
    { pattern: '/deals/:dealId', current: 'Deal details', parent: { label: 'Deals', to: '/deals' } },
    { pattern: '/tasks', current: 'Tasks' },
    { pattern: '/activity', current: 'Notes / activity' },
    { pattern: '/admin', current: 'Admin control plane' },
    { pattern: '/reports', current: 'Reports' },
    { pattern: '/settings', current: 'Settings' },
  ]

  for (const entry of hierarchyPatterns) {
    if (matchPath({ path: entry.pattern, end: true }, pathname)) {
      const crumbs = [...baseCrumbs]
      if (entry.parent) {
        crumbs.push(entry.parent)
      }
      crumbs.push({ label: entry.current })
      return crumbs
    }
  }

  return [...baseCrumbs, { label: 'Workspace' }]
}

const SIDEBAR_STATE_STORAGE_KEY = 'ui.sidebar_collapsed'
const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2
const GLOBAL_SEARCH_RESULT_LIMIT = 8
const GLOBAL_SEARCH_DEBOUNCE_MS = 250

const NavigationList = ({
	onNavigate,
	collapsed = false
}: {
		onNavigate?: () => void;
		collapsed?: boolean
}) => {
  return (
    <nav className="space-y-1">
      {NAVIGATION_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-xl px-3 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900',
              collapsed ? 'justify-center gap-0 px-2' : 'gap-2',
              isActive && 'bg-[var(--accent-50)] text-[var(--accent-800)]',
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {!collapsed ? <span>{item.label}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement))
    return false

  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable
}

/**
 * Global application shell with sidebar navigation and a thin context top bar.
 */
export const PageShell = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, token } = useAuth()
  const pageTitle = resolvePageTitle(location.pathname)
  const breadcrumbs = resolveBreadcrumbItems(location.pathname)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem(SIDEBAR_STATE_STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return
      }

      const isSearchShortcut =
        event.key === '/' || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))

      if (!isSearchShortcut) {
        return
      }

      // Keep global shortcuts from triggering browser find-in-page and focus the app search directly.
      event.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }

    window.addEventListener('keydown', handleKeyboardShortcut)
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcut)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(SIDEBAR_STATE_STORAGE_KEY, isSidebarCollapsed ? 'true' : 'false')
  }, [isSidebarCollapsed])

  const trimmedSearchQuery = searchQuery.trim()
  const shouldShowSearchHint =
    isSearchFocused &&
    trimmedSearchQuery.length > 0 &&
    trimmedSearchQuery.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH
  const shouldShowSearchResults =
    isSearchFocused &&
    (shouldShowSearchHint ||
      isSearching ||
      searchError !== null ||
      trimmedSearchQuery.length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH)

  useEffect(() => {
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
    setIsSearchFocused(false)
    setIsSearching(false)
    setActiveResultIndex(0)
  }, [location.pathname])

  useEffect(() => {
    if (!token || trimmedSearchQuery.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      setSearchResults([])
      setSearchError(null)
      setIsSearching(false)
      setActiveResultIndex(0)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true)
      setSearchError(null)

      const params = new URLSearchParams({
        q: trimmedSearchQuery,
        limit: String(GLOBAL_SEARCH_RESULT_LIMIT),
      })

      void apiRequest<GlobalSearchResult[]>(`/api/search?${params.toString()}`, {
        token,
        signal: controller.signal,
      })
        .then((results) => {
          if (controller.signal.aborted) {
            return
          }

          setSearchResults(results)
          setActiveResultIndex(0)
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return
          }

          setSearchResults([])
          setSearchError(error instanceof ApiError ? error.message : 'Search failed. Try again.')
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false)
          }
        })
    }, GLOBAL_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [token, trimmedSearchQuery])

  function clearSearch(shouldBlur = false) {
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
    setIsSearching(false)
    setActiveResultIndex(0)

    if (shouldBlur) {
      searchInputRef.current?.blur()
      setIsSearchFocused(false)
    }
  }

  function selectSearchResult(result: GlobalSearchResult) {
    clearSearch(true)
    navigate(result.route)
  }

  return (
    <div className="app-shell min-h-screen text-neutral-950">
      <div className="mx-auto flex w-full max-w-[1320px]">
        <aside
          data-testid="desktop-sidebar"
          data-collapsed={isSidebarCollapsed ? 'true' : 'false'}
          className={cn(
            'app-sidebar sticky top-0 hidden h-screen shrink-0 border-r py-6 transition-all duration-200 lg:block',
            isSidebarCollapsed ? 'w-20 px-3' : 'w-64 px-4',
          )}
        >
          <div className={cn('mb-6', isSidebarCollapsed ? 'px-0' : 'px-2')}>
            <div className={cn('flex items-center', isSidebarCollapsed ? 'justify-center' : 'justify-between')}>
              {!isSidebarCollapsed ? (
                <div>
                  <p className="text-xs font-medium text-neutral-500">LeadsDB</p>
                  <h1 className="mt-1 text-lg font-semibold tracking-tight">Operator console</h1>
                </div>
              ) : null}
              <Button
                data-testid="sidebar-toggle"
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={!isSidebarCollapsed}
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => {
                  setIsSidebarCollapsed((current) => !current)
                }}
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <NavigationList collapsed={isSidebarCollapsed} />
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-neutral-200 bg-[var(--surface-canvas)]">
            <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
              <div className="flex items-center gap-3">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                      <Menu className="h-4 w-4" />
                      <span className="sr-only">Open navigation</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <div className="mt-8">
                      <NavigationList />
                    </div>
                  </SheetContent>
                </Sheet>
                <div>
                  <nav
                    aria-label="Breadcrumb"
                    data-testid="page-breadcrumb"
                    className="flex items-center gap-1 overflow-x-auto text-xs text-neutral-500"
                  >
                    {breadcrumbs.map((item, index) => (
                      <span key={`${item.label}-${index}`} className="flex items-center gap-1">
                        {item.to ? (
                          <Link to={item.to} className="rounded px-1 py-0.5 transition-colors hover:text-neutral-700">
                            {item.label}
                          </Link>
                        ) : (
                          <span className="rounded px-1 py-0.5 text-neutral-700">{item.label}</span>
                        )}
                        {index < breadcrumbs.length - 1 ? <span aria-hidden="true">/</span> : null}
                      </span>
                    ))}
                  </nav>
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">{pageTitle}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative hidden md:block">
                  <Search
                    className={cn(
                      'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors',
                      isSearchFocused ? 'text-emerald-600' : 'text-neutral-400',
                    )}
                  />
                  <Input
                    ref={searchInputRef}
                    aria-label="Global search"
                    data-testid="global-search-input"
                    className={cn(
                      'pl-9 pr-14 transition-all duration-200 ease-out',
                      isSearchFocused || searchQuery.trim() ? 'w-80 shadow-sm' : 'w-64',
                    )}
                    placeholder="Search contacts, companies, deals"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value)
                      setSearchError(null)
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        if (!searchResults.length) {
                          return
                        }

                        event.preventDefault()
                        setActiveResultIndex((current) => Math.min(current + 1, searchResults.length - 1))
                        return
                      }

                      if (event.key === 'ArrowUp') {
                        if (!searchResults.length) {
                          return
                        }

                        event.preventDefault()
                        setActiveResultIndex((current) => Math.max(current - 1, 0))
                        return
                      }

                      if (event.key === 'Enter') {
                        const activeResult = searchResults[activeResultIndex]
                        if (!activeResult) {
                          return
                        }

                        event.preventDefault()
                        selectSearchResult(activeResult)
                        return
                      }

                      if (event.key === 'Escape') {
                        if (searchQuery.trim()) {
                          clearSearch()
                          return
                        }

                        event.currentTarget.blur()
                      }
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 transition-opacity',
                      isSearchFocused ? 'opacity-0' : 'opacity-100',
                    )}
                  >
                    / or Ctrl/Cmd+K
                  </span>
                  {shouldShowSearchResults ? (
                    <div
                      data-testid="global-search-results"
                      className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
                    >
                      {shouldShowSearchHint ? (
                        <p data-testid="global-search-status" className="px-4 py-3 text-sm text-neutral-600">
                          Type at least 2 characters to search across contacts, companies, and deals.
                        </p>
                      ) : null}

                      {!shouldShowSearchHint && isSearching ? (
                        <p data-testid="global-search-status" className="px-4 py-3 text-sm text-neutral-600">
                          Searching across contacts, companies, and deals...
                        </p>
                      ) : null}

                      {!shouldShowSearchHint && !isSearching && searchError ? (
                        <p data-testid="global-search-status" className="px-4 py-3 text-sm text-rose-600">
                          {searchError}
                        </p>
                      ) : null}

                      {!shouldShowSearchHint && !isSearching && !searchError ? (
                        searchResults.length > 0 ? (
                          <ul className="py-2">
                            {searchResults.map((result, index) => (
                              <li key={`${result.entity_type}-${result.entity_id}`}>
                                <button
                                  type="button"
                                  data-testid={`global-search-result-${index}`}
                                  className={cn(
                                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                                    index === activeResultIndex ? 'bg-[var(--accent-50)]' : 'hover:bg-neutral-50',
                                  )}
                                  onMouseDown={(event) => {
                                    // Keep focus on the input so pointer selection does not collapse the panel early.
                                    event.preventDefault()
                                  }}
                                  onClick={() => selectSearchResult(result)}
                                >
                                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
                                    {result.entity_type}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-neutral-900">
                                      {result.title}
                                    </span>
                                    {result.subtitle ? (
                                      <span className="block truncate text-xs text-neutral-500">
                                        {result.subtitle}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p data-testid="global-search-status" className="px-4 py-3 text-sm text-neutral-600">
                            No matches found for &ldquo;{trimmedSearchQuery}&rdquo;.
                          </p>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <QuickAddDialog />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-28 justify-start">
                      {user?.name ?? 'User'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user?.email ?? 'No email'}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-8 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
