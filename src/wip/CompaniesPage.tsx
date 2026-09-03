import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Copy, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { DataTable } from '../components/app/data-table.tsx'
import { DetailSidebar } from '../components/app/detail-sidebar.tsx'
import { DuplicateReviewCard } from '../components/app/duplicate-review-card.tsx'
import { EntityHeader } from '../components/app/entity-header.tsx'
import { SaveViewDialog } from '../components/app/save-view-dialog.tsx'
import { SectionHeader } from '../components/app/section-header.tsx'
import { Badge } from '../components/ui/badge.tsx'
import { Button } from '../components/ui/button.tsx'
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import { apiRequest } from '../lib/api.js'
import {
  buildCustomSavedViewKey,
  listSavedViews,
  normalizeSavedViewLabel,
  upsertSavedView,
} from '../lib/saved-views.ts'
import type { Company } from '../types/entities.ts'

type CreateCompanyPayload = {
  name: string
  website?: string | null
  industry?: string | null
}

const COMPANY_SAVED_VIEWS = [
  { key: 'all', label: 'All companies', search: '', industry: 'all', sort: 'recent' },
  { key: 'with-website', label: 'With website', search: '', industry: 'all', sort: 'name-asc' },
  { key: 'missing-industry', label: 'Missing industry', search: '', industry: '__none__', sort: 'name-asc' },
] as const

type CompanySortOption = 'recent' | 'name-asc' | 'name-desc'
type CompanySavedViewDefinition = {
  key: string
  label: string
  search: string
  industry: string
  sort: CompanySortOption
  kind: 'preset' | 'custom'
}
const COMPANY_PRESET_VIEW_KEYS: ReadonlySet<string> = new Set(COMPANY_SAVED_VIEWS.map((view) => view.key))

function normalizeCompanySavedViewCriteria(criteria: Record<string, unknown>) {
  const search = typeof criteria.search === 'string' ? criteria.search : ''
  const industry = typeof criteria.industry === 'string' ? criteria.industry : 'all'
  const sort = ['recent', 'name-asc', 'name-desc'].includes(criteria.sort as CompanySortOption)
    ? (criteria.sort as CompanySortOption)
    : 'recent'
  return { search, industry, sort }
}

/**
 * Company workspace with structured overview + capture form.
 */
export function CompaniesPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [sortBy, setSortBy] = useState<CompanySortOption>('recent')
  const [activeSavedViewKey, setActiveSavedViewKey] = useState<string | null>('all')
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')
  const [saveViewError, setSaveViewError] = useState<string | null>(null)
  const [saveViewFeedback, setSaveViewFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const companiesQuery = useQuery({
    queryKey: ['companies', token],
    queryFn: () => apiRequest<Company[]>('/api/companies', { token }),
    enabled: Boolean(token),
  })

  const savedViewsQuery = useQuery({
    queryKey: ['saved-views', 'companies', token],
    queryFn: () => listSavedViews('companies', token),
    enabled: Boolean(token),
  })

  const createCompanyMutation = useMutation({
    mutationFn: async (payload: CreateCompanyPayload) => {
      return apiRequest<Company>('/api/companies', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      setName('')
      setWebsite('')
      setIndustry('')
      setError(null)
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message)
    },
  })

  const saveSavedViewMutation = useMutation({
    mutationFn: async ({ label, viewKey }: { label: string; viewKey: string }) => {
      return upsertSavedView(
        'companies',
        viewKey,
        {
          label,
          criteria: {
            search: searchQuery,
            industry: industryFilter,
            sort: sortBy,
          },
        },
        token,
      )
    },
    onSuccess: async (savedView) => {
      await queryClient.invalidateQueries({ queryKey: ['saved-views', 'companies'] })
      setActiveSavedViewKey(savedView.view_key)
      setSaveViewDialogOpen(false)
      setSaveViewError(null)
      setSaveViewFeedback(`Saved view "${savedView.label}" is ready to reuse.`)
    },
    onError: (mutationError: Error) => {
      setSaveViewError(mutationError.message)
    },
  })

  const companies = useMemo(() => companiesQuery.data ?? [], [companiesQuery.data])
  const savedViewDefinitions = useMemo<CompanySavedViewDefinition[]>(() => {
    const persistedViews = savedViewsQuery.data ?? []
    const presetViews = COMPANY_SAVED_VIEWS.map((view) => {
      return {
        ...view,
        sort: view.sort as CompanySortOption,
        kind: 'preset' as const,
      }
    })

    const customViews = persistedViews
      .filter((view) => !COMPANY_PRESET_VIEW_KEYS.has(view.view_key))
      .map((view) => ({
        key: view.view_key,
        label: view.label,
        ...normalizeCompanySavedViewCriteria((view.criteria as Record<string, unknown>) ?? {}),
        kind: 'custom' as const,
      }))

    return [...presetViews, ...customViews]
  }, [savedViewsQuery.data])
  const activeCustomSavedView = useMemo(
    () => savedViewDefinitions.find((view) => view.key === activeSavedViewKey && view.kind === 'custom') ?? null,
    [activeSavedViewKey, savedViewDefinitions],
  )
  const industryOptions = useMemo(
    () => [...new Set(companies.map((company) => company.industry?.trim()).filter(Boolean) as string[])].sort(),
    [companies],
  )
  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const hasQuery = query.length > 0

    const scoped = companies.filter((company) => {
      if (activeSavedViewKey === 'with-website' && !company.website) {
        return false
      }

      if (industryFilter === '__none__' && company.industry) {
        return false
      }

      if (industryFilter !== 'all' && industryFilter !== '__none__' && company.industry !== industryFilter) {
        return false
      }

      if (!hasQuery) {
        return true
      }

      return [company.name, company.website ?? '', company.industry ?? ''].some((value) =>
        value.toLowerCase().includes(query),
      )
    })

    const next = [...scoped]
    if (sortBy === 'name-asc') {
      next.sort((left, right) => left.name.localeCompare(right.name))
      return next
    }

    if (sortBy === 'name-desc') {
      next.sort((left, right) => right.name.localeCompare(left.name))
      return next
    }

    next.sort((left, right) => right.created_at.localeCompare(left.created_at))
    return next
  }, [activeSavedViewKey, companies, industryFilter, searchQuery, sortBy])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    await createCompanyMutation.mutateAsync({
      name,
      website: website || null,
      industry: industry || null,
    })
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // No-op until toast/error messaging is wired.
    }
  }

  function markFiltersAsUnsaved() {
    setActiveSavedViewKey(null)
    setSaveViewFeedback(null)
  }

  function applySavedView(key: string) {
    const nextView = savedViewDefinitions.find((view) => view.key === key)
    if (!nextView) {
      return
    }

    setActiveSavedViewKey(nextView.key)
    setSearchQuery(nextView.search)
    setIndustryFilter(nextView.industry)
    setSortBy(nextView.sort)
    setSaveViewFeedback(null)
    setSaveViewError(null)
  }

  function handleOpenSaveViewDialog() {
    setSaveViewName(activeCustomSavedView?.label ?? '')
    setSaveViewError(null)
    setSaveViewFeedback(null)
    setSaveViewDialogOpen(true)
  }

  function handleSaveCurrentView() {
    const normalizedLabel = normalizeSavedViewLabel(saveViewName)
    if (!normalizedLabel) {
      setSaveViewError('Enter a name for this saved view.')
      return
    }

    const existingKeys = (savedViewsQuery.data ?? []).map((view) => view.view_key)
    const viewKey = buildCustomSavedViewKey(normalizedLabel, existingKeys, activeCustomSavedView?.key)
    void saveSavedViewMutation.mutate({
      label: normalizedLabel,
      viewKey,
    })
  }

  return (
    <section className="space-y-6">
      <EntityHeader
        title="Companies"
        subtitle="Keep company records clean and easy to review."
        metadata={[
          { label: 'Total companies', value: String(companies.length) },
          { label: 'Visible now', value: String(filteredCompanies.length) },
          { label: 'Industries covered', value: String(new Set(companies.map((c) => c.industry).filter(Boolean)).size) },
          { label: 'Data quality', value: companies.length === 0 ? 'No records yet' : 'In progress' },
        ]}
        actions={
          <Badge variant="default" className="rounded-full px-3 py-1">
            Operator-owned
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <SectionHeader
                eyebrow="Overview"
                title="Account index"
                description="Company list for quick review and updates."
              />
            </CardHeader>
            <div className="space-y-4 px-6 pb-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <label htmlFor="companies-search" className="text-sm font-medium text-neutral-800">
                    Search companies
                  </label>
                  <Input
                    id="companies-search"
                    value={searchQuery}
                    onChange={(event) => {
                      markFiltersAsUnsaved()
                      setSearchQuery(event.target.value)
                    }}
                    placeholder="Search by company, website, or industry"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="companies-sort" className="text-sm font-medium text-neutral-800">
                    Sort by
                  </label>
                  <select
                    id="companies-sort"
                    value={sortBy}
                    onChange={(event) => {
                      markFiltersAsUnsaved()
                      setSortBy(event.target.value as CompanySortOption)
                    }}
                    className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  >
                    <option value="recent">Most recent</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="companies-industry-filter" className="text-sm font-medium text-neutral-800">
                    Industry filter
                  </label>
                  <select
                    id="companies-industry-filter"
                    value={industryFilter}
                    onChange={(event) => {
                      markFiltersAsUnsaved()
                      setIndustryFilter(event.target.value)
                    }}
                    className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  >
                    <option value="all">All industries</option>
                    <option value="__none__">No industry set</option>
                    {industryOptions.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-neutral-800">Saved views</p>
                  <div className="flex flex-wrap gap-2">
                    {savedViewDefinitions.map((view) => (
                      <Button
                        key={view.key}
                        type="button"
                        size="sm"
                        variant={activeSavedViewKey === view.key ? 'default' : 'outline'}
                        onClick={() => applySavedView(view.key)}
                      >
                        {view.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleOpenSaveViewDialog}
                      disabled={saveSavedViewMutation.isPending}
                    >
                      Save view
                    </Button>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Save a named personal view without changing the built-in presets.
                  </p>
                  {saveViewFeedback ? (
                    <p
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                      role="status"
                    >
                      {saveViewFeedback}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  cell: (company) => <span className="font-medium text-neutral-900">{company.name}</span>,
                },
                {
                  key: 'website',
                  header: 'Website',
                  cell: (company) => company.website || '—',
                },
                {
                  key: 'industry',
                  header: 'Industry',
                  cell: (company) => company.industry || '—',
                },
              ]}
              rows={filteredCompanies}
              emptyTitle={companies.length === 0 ? 'No companies yet' : 'No companies match these filters'}
              emptyDescription={
                companies.length === 0
                  ? 'Add your first company record to start account tracking.'
                  : 'Adjust search, filters, or saved views to show more results.'
              }
              emptyAction={
                companies.length === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      document.getElementById('company-name')?.focus()
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create first company
                  </Button>
                ) : null
              }
              enableSelection
              onRowClick={(company) => navigate(`/companies/${company.id}`)}
              rowActions={(company) => [
                {
                  label: 'Open details',
                  onSelect: () => navigate(`/companies/${company.id}`),
                  shortcut: 'Enter',
                },
                {
                  label: 'Copy website',
                  icon: <Copy className="h-4 w-4" />,
                  disabled: !company.website,
                  onSelect: () => {
                    if (company.website) {
                      void copyToClipboard(company.website)
                    }
                  },
                },
                {
                  label: 'Copy company ID',
                  onSelect: () => {
                    void copyToClipboard(company.id)
                  },
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes and timeline</CardTitle>
              <CardDescription>Company notes and activity history will appear here.</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>New company</CardTitle>
              <CardDescription>Add a company to start tracking contacts and deals.</CardDescription>
            </CardHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-800" htmlFor="company-name">
                  Company name
                </label>
                <Input
                  id="company-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Northfield Advisory"
                />
                <p className="text-xs text-neutral-500">Use the legal or commonly recognized account name.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-800" htmlFor="company-website">
                  Website
                </label>
                <Input
                  id="company-website"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://northfield.example"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-800" htmlFor="company-industry">
                  Industry
                </label>
                <Input
                  id="company-industry"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  placeholder="Financial services"
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={createCompanyMutation.isPending}>
                <Plus className="h-4 w-4" />
                {createCompanyMutation.isPending ? 'Saving...' : 'Create company'}
              </Button>
            </form>
          </Card>

          <DetailSidebar
            quickFacts={[
              { label: 'Total companies', value: String(companies.length) },
              { label: 'With website', value: String(companies.filter((company) => company.website).length) },
              { label: 'With industry tag', value: String(companies.filter((company) => company.industry).length) },
            ]}
            related={['Linked contacts', 'Related deals', 'Recent activity']}
            nextActions={[
              'Fill missing industry labels for new accounts.',
              'Link at least one contact to each active company.',
              'Review account list weekly for duplicates.',
            ]}
          />

          <DuplicateReviewCard
            entityType="companies"
            title="Possible duplicate companies"
            description="Review exact company-name matches before linked contacts and deals diverge between account records."
            token={token}
            invalidateQueryKeys={[['companies'], ['contacts'], ['deals']]}
          />
        </div>
      </div>

      <Card className="border-dashed">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Building2 className="h-4 w-4" />
          Open any row to view full company details.
        </div>
      </Card>

      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={(open) => {
          setSaveViewDialogOpen(open)
          if (!open) {
            setSaveViewError(null)
          }
        }}
        viewName={saveViewName}
        onViewNameChange={setSaveViewName}
        onSave={handleSaveCurrentView}
        isPending={saveSavedViewMutation.isPending}
        errorMessage={saveViewError}
        submitLabel={activeCustomSavedView ? 'Update view' : 'Save view'}
      />
    </section>
  )
}
