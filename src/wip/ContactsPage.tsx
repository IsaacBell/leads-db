import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from "@/src/lib/auth/useAuth"
import { DataTable } from "@/src/components/wip/app/data-table"
import { DetailSidebar } from "@/src/components/wip/app/detail-sidebar"
import { DuplicateReviewCard } from "@/src/components/wip/app/duplicate-review-card"
import { EntityHeader } from "@/src/components/wip/app/entity-header"
import { SaveViewDialog } from "@/src/components/wip/app/save-view-dialog"
import { SectionHeader } from "@/src/components/wip/app/section-header"
import { StatusBadge } from "@/src/components/wip/app/status-badge"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import { Input } from "@/src/components/wip/layout/ui/input"
import { ApiError, apiRequest } from '../lib/api'
import {
  buildCustomSavedViewKey,
  listSavedViews,
  normalizeSavedViewLabel,
  upsertSavedView,
} from '../lib/saved-views'
import type { Company, Contact } from '../types/entities'

type CreateContactPayload = {
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  company_id?: string | null
  status?: string
}

type CreateCompanyPayload = {
  name: string
  website?: string | null
  industry?: string | null
}

const CONTACT_STATUSES = ['lead', 'qualified', 'customer', 'inactive'] as const
const CONTACT_TABLE_FILTER_STATUSES = ['all', ...CONTACT_STATUSES] as const
const CONTACT_SAVED_VIEWS = [
  { key: 'all', label: 'All contacts', search: '', status: 'all', sort: 'recent' },
  { key: 'unassigned', label: 'No company', search: '', status: 'all', sort: 'name-asc' },
  { key: 'qualified', label: 'Qualified', search: '', status: 'qualified', sort: 'name-asc' },
] as const

type ContactFilterStatus = (typeof CONTACT_TABLE_FILTER_STATUSES)[number]
type ContactSortOption = 'recent' | 'name-asc' | 'name-desc'
type ContactSavedViewDefinition = {
  key: string
  label: string
  search: string
  status: ContactFilterStatus
  sort: ContactSortOption
  kind: 'preset' | 'custom'
}

const EMPTY_CONTACTS: Contact[] = []
const EMPTY_COMPANIES: Company[] = []
const CONTACT_PRESET_VIEW_KEYS: ReadonlySet<string> = new Set(CONTACT_SAVED_VIEWS.map((view) => view.key))

function normalizeContactSavedViewCriteria(criteria: Record<string, unknown>) {
  const search = typeof criteria.search === 'string' ? criteria.search : ''
  const status = CONTACT_TABLE_FILTER_STATUSES.includes(criteria.status as ContactFilterStatus)
    ? (criteria.status as ContactFilterStatus)
    : 'all'
  const sort = ['recent', 'name-asc', 'name-desc'].includes(criteria.sort as ContactSortOption)
    ? (criteria.sort as ContactSortOption)
    : 'recent'
  return { search, status, sort }
}

/**
 * Contacts page with people records, statuses, and relationship context.
 */
export function ContactsPage() {
  const navigate = useNavigate()
  const { token, logout } = useAuth()
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [status, setStatus] = useState<(typeof CONTACT_STATUSES)[number]>('lead')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactFilterStatus>('all')
  const [sortBy, setSortBy] = useState<ContactSortOption>('recent')
  const [activeSavedViewKey, setActiveSavedViewKey] = useState<string | null>('all')
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')
  const [saveViewError, setSaveViewError] = useState<string | null>(null)
  const [saveViewFeedback, setSaveViewFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const contactsQuery = useQuery({
    queryKey: ['contacts', token],
    queryFn: () => apiRequest<Contact[]>('/api/contacts', { token }),
    enabled: Boolean(token),
  })

  const companiesQuery = useQuery({
    queryKey: ['companies', token],
    queryFn: () => apiRequest<Company[]>('/api/companies', { token }),
    enabled: Boolean(token),
  })

  const savedViewsQuery = useQuery({
    queryKey: ['saved-views', 'contacts', token],
    queryFn: () => listSavedViews('contacts', token),
    enabled: Boolean(token),
  })

  const createContactMutation = useMutation({
    mutationFn: async (payload: CreateContactPayload) => {
      return apiRequest<Contact>('/api/contacts', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setCompanyId('')
      setStatus('lead')
      setError(null)
    },
    onError: (mutationError: Error) => {
      if (mutationError instanceof ApiError && mutationError.status === 401) {
        setError('Your session expired. Sign in again, then retry creating the contact.')
        logout()
        return
      }
      setError(mutationError.message)
    },
  })

  const createCompanyMutation = useMutation({
    mutationFn: async (payload: CreateCompanyPayload) => {
      return apiRequest<Company>('/api/companies', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async (createdCompany) => {
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      // Keep operators in-flow by linking the new company immediately.
      setCompanyId(createdCompany.id)
      setNewCompanyName('')
      setError(null)
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message)
    },
  })

  const saveSavedViewMutation = useMutation({
    mutationFn: async ({ label, viewKey }: { label: string; viewKey: string }) => {
      return upsertSavedView(
        'contacts',
        viewKey,
        {
          label,
          criteria: {
            search: searchQuery,
            status: statusFilter,
            sort: sortBy,
          },
        },
        token,
      )
    },
    onSuccess: async (savedView) => {
      await queryClient.invalidateQueries({ queryKey: ['saved-views', 'contacts'] })
      setActiveSavedViewKey(savedView.view_key)
      setSaveViewDialogOpen(false)
      setSaveViewError(null)
      setSaveViewFeedback(`Saved view "${savedView.label}" is ready to reuse.`)
    },
    onError: (mutationError: Error) => {
      setSaveViewError(mutationError.message)
    },
  })

  const contacts = contactsQuery.data ?? EMPTY_CONTACTS
  const companies = companiesQuery.data ?? EMPTY_COMPANIES
  const savedViewDefinitions = useMemo<ContactSavedViewDefinition[]>(() => {
    const persistedViews = savedViewsQuery.data ?? []
    const presetViews = CONTACT_SAVED_VIEWS.map((view) => {
      return {
        ...view,
        status: view.status as ContactFilterStatus,
        sort: view.sort as ContactSortOption,
        kind: 'preset' as const,
      }
    })

    const customViews = persistedViews
      .filter((view) => !CONTACT_PRESET_VIEW_KEYS.has(view.view_key))
      .map((view) => ({
        key: view.view_key,
        label: view.label,
        ...normalizeContactSavedViewCriteria((view.criteria as Record<string, unknown>) ?? {}),
        kind: 'custom' as const,
      }))

    return [...presetViews, ...customViews]
  }, [savedViewsQuery.data])
  const activeCustomSavedView = useMemo(
    () => savedViewDefinitions.find((view) => view.key === activeSavedViewKey && view.kind === 'custom') ?? null,
    [activeSavedViewKey, savedViewDefinitions],
  )
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies])
  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const hasQuery = query.length > 0

    const scoped = contacts.filter((contact) => {
      if (activeSavedViewKey === 'unassigned' && contact.company_id) {
        return false
      }

      if (statusFilter !== 'all' && contact.status !== statusFilter) {
        return false
      }

      if (!hasQuery) {
        return true
      }

      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase()
      const companyName = contact.company_id ? (companyById.get(contact.company_id) ?? '').toLowerCase() : ''
      return [fullName, contact.email ?? '', contact.phone ?? '', companyName].some((value) =>
        value.toLowerCase().includes(query),
      )
    })

    const next = [...scoped]
    if (sortBy === 'name-asc') {
      next.sort((left, right) =>
        `${left.first_name} ${left.last_name}`.localeCompare(`${right.first_name} ${right.last_name}`),
      )
      return next
    }

    if (sortBy === 'name-desc') {
      next.sort((left, right) =>
        `${right.first_name} ${right.last_name}`.localeCompare(`${left.first_name} ${left.last_name}`),
      )
      return next
    }

    next.sort((left, right) => right.created_at.localeCompare(left.created_at))
    return next
  }, [activeSavedViewKey, companyById, contacts, searchQuery, sortBy, statusFilter])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!token) {
      setError('You are not signed in. Sign in again and retry.')
      return
    }

    await createContactMutation.mutateAsync({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      company_id: companyId || null,
      status,
    })
  }

  async function handleInlineCompanyCreate() {
    const trimmedName = newCompanyName.trim()
    if (!trimmedName) {
      setError('Enter a company name before creating.')
      return
    }

    setError(null)
    await createCompanyMutation.mutateAsync({
      name: trimmedName,
      website: null,
      industry: null,
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
    setStatusFilter(nextView.status)
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
        title="Contacts"
        subtitle="Keep people records up to date and easy to act on."
        metadata={[
          { label: 'Total contacts', value: String(contacts.length) },
          { label: 'Visible now', value: String(filteredContacts.length) },
          { label: 'Qualified', value: String(contacts.filter((item) => item.status === 'qualified').length) },
          { label: 'Without company', value: String(contacts.filter((item) => !item.company_id).length) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <SectionHeader
                eyebrow="Overview"
                title="Relationship roster"
                description="Contact list with status and linked company."
              />
            </CardHeader>
            <div className="space-y-4 px-6 pb-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <label htmlFor="contacts-search" className="text-sm font-medium text-neutral-800">
                    Search contacts
                  </label>
                  <Input
                    id="contacts-search"
                    value={searchQuery}
                    onChange={(event) => {
                      markFiltersAsUnsaved()
                      setSearchQuery(event.target.value)
                    }}
                    placeholder="Search name, email, phone, or company"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contacts-sort" className="text-sm font-medium text-neutral-800">
                    Sort by
                  </label>
                  <select
                    id="contacts-sort"
                    value={sortBy}
                    onChange={(event) => {
                      markFiltersAsUnsaved()
                      setSortBy(event.target.value as ContactSortOption)
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
                  <label htmlFor="contacts-status-filter" className="text-sm font-medium text-neutral-800">
                    Status filter
                  </label>
                  <select
                    id="contacts-status-filter"
                    value={statusFilter}
                    onChange={(event) => {
                      markFiltersAsUnsaved()
                      setStatusFilter(event.target.value as ContactFilterStatus)
                    }}
                    className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  >
                    {CONTACT_TABLE_FILTER_STATUSES.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry === 'all' ? 'All statuses' : entry}
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
                  cell: (contact) => (
                    <p className="font-medium text-neutral-900">{contact.first_name} {contact.last_name}</p>
                  ),
                },
                {
                  key: 'email',
                  header: 'Email',
                  cell: (contact) => contact.email || '—',
                },
                {
                  key: 'company',
                  header: 'Company',
                  cell: (contact) =>
                    contact.company_id ? companyById.get(contact.company_id) || '—' : 'Unassigned',
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (contact) => <StatusBadge value={contact.status} />,
                },
              ]}
              rows={filteredContacts}
              emptyTitle={contacts.length === 0 ? 'No contacts yet' : 'No contacts match these filters'}
              emptyDescription={
                contacts.length === 0
                  ? 'Create your first contact to start managing relationships.'
                  : 'Adjust search, filters, or saved view presets to expand results.'
              }
              emptyAction={
                contacts.length === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      document.getElementById('contact-first-name')?.focus()
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create first contact
                  </Button>
                ) : null
              }
              enableSelection
              onRowClick={(contact) => navigate(`/contacts/${contact.id}`)}
              rowActions={(contact) => [
                {
                  label: 'Open details',
                  onSelect: () => navigate(`/contacts/${contact.id}`),
                  shortcut: 'Enter',
                },
                {
                  label: 'Copy email',
                  icon: <Copy className="h-4 w-4" />,
                  disabled: !contact.email,
                  onSelect: () => {
                    if (contact.email) {
                      void copyToClipboard(contact.email)
                    }
                  },
                },
                {
                  label: 'Copy contact ID',
                  onSelect: () => {
                    void copyToClipboard(contact.id)
                  },
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline / activity</CardTitle>
              <CardDescription>Contact notes and interaction history will appear here.</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>New contact</CardTitle>
              <CardDescription>Add a person and define current relationship status.</CardDescription>
            </CardHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="contact-first-name" className="text-sm font-medium text-neutral-800">
                    First name
                  </label>
                  <Input
                    id="contact-first-name"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-last-name" className="text-sm font-medium text-neutral-800">
                    Last name
                  </label>
                  <Input
                    id="contact-last-name"
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-email" className="text-sm font-medium text-neutral-800">
                  Email
                </label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-phone" className="text-sm font-medium text-neutral-800">
                  Phone
                </label>
                <Input id="contact-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-company" className="text-sm font-medium text-neutral-800">
                  Company
                </label>
                <select
                  id="contact-company"
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <option value="">No linked company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Input
                    id="contact-inline-company-name"
                    aria-label="Create and link company"
                    value={newCompanyName}
                    onChange={(event) => setNewCompanyName(event.target.value)}
                    placeholder="Create and link company"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleInlineCompanyCreate()}
                    disabled={createCompanyMutation.isPending}
                  >
                    {createCompanyMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-status" className="text-sm font-medium text-neutral-800">
                  Relationship status
                </label>
                <select
                  id="contact-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as (typeof CONTACT_STATUSES)[number])}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  {CONTACT_STATUSES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={createContactMutation.isPending}>
                <Plus className="h-4 w-4" />
                {createContactMutation.isPending ? 'Saving...' : 'Create contact'}
              </Button>
            </form>
          </Card>

          <DetailSidebar
            quickFacts={[
              { label: 'Leads', value: String(contacts.filter((item) => item.status === 'lead').length) },
              { label: 'Qualified', value: String(contacts.filter((item) => item.status === 'qualified').length) },
              { label: 'Customers', value: String(contacts.filter((item) => item.status === 'customer').length) },
            ]}
            related={['Linked company', 'Related deals', 'Recent activity']}
            nextActions={[
              'Review leads with no linked company.',
              'Capture next step notes after each call.',
              'Normalize phone and email formats for consistency.',
            ]}
          />

          <DuplicateReviewCard
            entityType="contacts"
            title="Possible duplicate contacts"
            description="Review exact email and phone matches before duplicate people records spread across deals and activity."
            token={token}
            invalidateQueryKeys={[['contacts'], ['deals'], ['activities']]}
          />
        </div>
      </div>

      <Card className="border-dashed">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <UserCircle2 className="h-4 w-4" />
          Open any row to view full contact details.
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
