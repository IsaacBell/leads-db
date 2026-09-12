import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from "@/src/lib/auth/useAuth"
import { DetailSidebar } from "@/src/components/wip/app/detail-sidebar"
import { EmptyState } from "@/src/components/wip/app/empty-state"
import { EntityHeader } from "@/src/components/wip/app/entity-header"
import { SectionHeader } from "@/src/components/wip/app/section-header"
import { StatusBadge } from "@/src/components/wip/app/status-badge"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import { apiRequest } from '../lib/api'
import type { Company, Contact, Deal } from '../types/entities'

const EMPTY_COMPANIES: Company[] = []
const EMPTY_CONTACTS: Contact[] = []
const EMPTY_DEALS: Deal[] = []

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown'
  }
  return new Date(value).toLocaleDateString()
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

export function CompanyDetailPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { companyId = '' } = useParams<{ companyId: string }>()

  const companiesQuery = useQuery({
    queryKey: ['companies', token],
    queryFn: () => apiRequest<Company[]>('/api/companies', { token }),
    enabled: Boolean(token),
  })

  const contactsQuery = useQuery({
    queryKey: ['contacts', token],
    queryFn: () => apiRequest<Contact[]>('/api/contacts', { token }),
    enabled: Boolean(token),
  })

  const dealsQuery = useQuery({
    queryKey: ['deals', token],
    queryFn: () => apiRequest<Deal[]>('/api/deals', { token }),
    enabled: Boolean(token),
  })

  const companies = companiesQuery.data ?? EMPTY_COMPANIES
  const contacts = contactsQuery.data ?? EMPTY_CONTACTS
  const deals = dealsQuery.data ?? EMPTY_DEALS

  const company = useMemo(() => companies.find((item) => item.id === companyId) ?? null, [companies, companyId])
  const relatedContacts = useMemo(() => contacts.filter((item) => item.company_id === companyId), [contacts, companyId])
  const relatedDeals = useMemo(() => deals.filter((item) => item.company_id === companyId), [deals, companyId])

  const isLoading = companiesQuery.isLoading || contactsQuery.isLoading || dealsQuery.isLoading
  const loadError = companiesQuery.error ?? contactsQuery.error ?? dealsQuery.error

  if (isLoading) {
    return (
      <section className="space-y-6">
        <SectionHeader eyebrow="Company details" title="Loading company..." />
        <Card>
          <CardHeader>
            <CardTitle>Fetching record</CardTitle>
            <CardDescription>Loading company details and related records.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="space-y-6">
        <SectionHeader eyebrow="Company details" title="Could not load company" />
        <EmptyState
          title="Data unavailable"
          description={loadError instanceof Error ? loadError.message : 'Try refreshing this view.'}
        />
      </section>
    )
  }

  if (!company) {
    return (
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Company details"
          title="Company not found"
          description="This company may have been removed or is no longer available."
          actions={
            <Button variant="outline" onClick={() => navigate('/companies')}>
              <ArrowLeft className="h-4 w-4" />
              Back to companies
            </Button>
          }
        />
        <EmptyState title="Record unavailable" description="Return to companies and select another account." />
      </section>
    )
  }

  const pipelineValue = relatedDeals.reduce((sum, deal) => sum + deal.amount, 0)

  return (
    <section className="space-y-6">
      <EntityHeader
        title={company.name}
        subtitle="Contacts, deals, and key company details in one place."
        metadata={[
          { label: 'Industry', value: company.industry ?? 'Not set' },
          { label: 'Website', value: company.website ?? 'Not set' },
          { label: 'Created', value: formatDate(company.created_at) },
        ]}
        actions={
          <Button variant="outline" onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Linked contacts</CardTitle>
              <CardDescription>People currently associated with this account.</CardDescription>
            </CardHeader>
            {relatedContacts.length === 0 ? (
              <p className="text-sm text-neutral-600">No linked contacts yet.</p>
            ) : (
              <ul className="space-y-3">
                {relatedContacts.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-sm text-neutral-600">{contact.email ?? 'Email not set'}</p>
                    </div>
                    <StatusBadge value={contact.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related deals</CardTitle>
              <CardDescription>Pipeline opportunities tied to this company.</CardDescription>
            </CardHeader>
            {relatedDeals.length === 0 ? (
              <p className="text-sm text-neutral-600">No related deals yet.</p>
            ) : (
              <ul className="space-y-3">
                {relatedDeals.map((deal) => (
                  <li key={deal.id} className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{deal.name}</p>
                      <p className="text-sm text-neutral-600">{formatUsd(deal.amount)}</p>
                    </div>
                    <StatusBadge value={deal.stage} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4">
          <DetailSidebar
            quickFacts={[
              { label: 'Contacts', value: String(relatedContacts.length) },
              { label: 'Deals', value: String(relatedDeals.length) },
              { label: 'Pipeline value', value: formatUsd(pipelineValue) },
            ]}
            related={[
              `Industry: ${company.industry ?? 'Not tagged'}`,
              `Website: ${company.website ?? 'Not set'}`,
              'Activity timeline and tasks',
            ]}
            nextActions={[
              'Review company records for missing fields.',
              'Ensure each active deal has an assigned contact.',
              'Capture account-specific notes after meetings.',
            ]}
          />
        </div>
      </div>
    </section>
  )
}
