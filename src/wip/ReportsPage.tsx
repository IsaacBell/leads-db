import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Download, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from "@/src/lib/auth/useAuth"
import { DataTable } from "@/src/components/wip/app/data-table"
import { EmptyState } from "@/src/components/wip/app/empty-state"
import { MetricCard } from "@/src/components/wip/app/metric-card"
import { SectionHeader } from "@/src/components/wip/app/section-header"
import { StatusBadge } from "@/src/components/wip/app/status-badge"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import { apiRequest } from '@/src/lib/api'
import type { Company, Contact, Deal } from '@/src/types/entities'

type DateWindow = '30d' | '90d' | 'all'
type StageFilter = 'all' | 'open' | 'won' | 'lost'

const EMPTY_DEALS: Deal[] = []
const EMPTY_CONTACTS: Contact[] = []
const EMPTY_COMPANIES: Company[] = []

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function parseDateWindow(windowValue: DateWindow): Date | null {
  if (windowValue === 'all') {
    return null
  }

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const lookback = windowValue === '30d' ? 30 : 90
  return new Date(now - dayMs * lookback)
}

function buildCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0] ?? {})
  // Prevent spreadsheet formula injection when exporting user-controlled values.
  const escape = (value: string | number) => {
    const raw = String(value)
    const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
    return `"${formulaSafe.replaceAll('"', '""')}"`
  }
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function getStageFilterTarget(stage: string): StageFilter {
  if (stage === 'Won') {
    return 'won'
  }
  if (stage === 'Lost') {
    return 'lost'
  }
  return 'open'
}

function getStageFilterLabel(stage: string) {
  const target = getStageFilterTarget(stage)
  if (target === 'won') {
    return 'Show won deals'
  }
  if (target === 'lost') {
    return 'Show lost deals'
  }
  return 'Show open deals'
}

export function ReportsPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [dateWindow, setDateWindow] = useState<DateWindow>('90d')
  const [stageFilter, setStageFilter] = useState<StageFilter>('all')

  const dealsQuery = useQuery({
    queryKey: ['deals', token],
    queryFn: () => apiRequest<Deal[]>('/api/deals', { token }),
    enabled: Boolean(token),
  })

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

  const deals = dealsQuery.data ?? EMPTY_DEALS
  const contacts = contactsQuery.data ?? EMPTY_CONTACTS
  const companies = companiesQuery.data ?? EMPTY_COMPANIES

  const filteredDeals = useMemo(() => {
    const windowStart = parseDateWindow(dateWindow)

    return deals.filter((deal) => {
      const createdAt = new Date(deal.created_at)
      const inDateWindow = windowStart ? createdAt >= windowStart : true
      if (!inDateWindow) {
        return false
      }

      if (stageFilter === 'all') {
        return true
      }
      if (stageFilter === 'open') {
        return !['Won', 'Lost'].includes(deal.stage)
      }
      if (stageFilter === 'won') {
        return deal.stage === 'Won'
      }
      return deal.stage === 'Lost'
    })
  }, [dateWindow, deals, stageFilter])

  const winRate = useMemo(() => {
    const closedDeals = filteredDeals.filter((deal) => ['Won', 'Lost'].includes(deal.stage))
    if (closedDeals.length === 0) {
      return 0
    }
    const wonCount = closedDeals.filter((deal) => deal.stage === 'Won').length
    return Math.round((wonCount / closedDeals.length) * 100)
  }, [filteredDeals])

  const openPipelineValue = useMemo(
    () => filteredDeals.filter((deal) => !['Won', 'Lost'].includes(deal.stage)).reduce((sum, deal) => sum + deal.amount, 0),
    [filteredDeals],
  )

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const deal of filteredDeals) {
      counts.set(deal.stage, (counts.get(deal.stage) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredDeals])

  const companyNameById = useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies])
  const contactNameById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, `${contact.first_name} ${contact.last_name}`])),
    [contacts],
  )

  function handleExportCsv() {
    const csvRows = filteredDeals.map((deal) => ({
      deal_id: deal.id,
      deal_name: deal.name,
      stage: deal.stage,
      amount_usd: deal.amount,
      company_name: companyNameById.get(deal.company_id) ?? 'Unassigned',
      contact_name: contactNameById.get(deal.contact_id) ?? 'Unassigned',
      created_at: deal.created_at,
      expected_close_date: deal.expected_close_date ?? '',
    }))
    downloadCsv('report-deals.csv', buildCsv(csvRows))
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // No-op until global toast feedback is wired.
    }
  }

  return (
    <section className="space-y-8">
      <SectionHeader
        eyebrow="Reports"
        title="Reporting"
        description="Track pipeline performance, stage conversion, and recent activity from live workspace data."
        actions={
          <Button type="button" variant="outline" onClick={handleExportCsv} disabled={filteredDeals.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
          <CardDescription>Adjust date and stage filters to focus this report set.</CardDescription>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-neutral-800">Date range</span>
            <select
              value={dateWindow}
              onChange={(event) => setDateWindow(event.target.value as DateWindow)}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-neutral-800">Deal status</span>
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as StageFilter)}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <option value="all">All deals</option>
              <option value="open">Open deals</option>
              <option value="won">Won only</option>
              <option value="lost">Lost only</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Deals in scope" value={String(filteredDeals.length)} icon={<Filter className="h-5 w-5" />} />
        <MetricCard label="Open pipeline value" value={formatUsd(openPipelineValue)} />
        <MetricCard label="Closed win rate" value={`${winRate}%`} />
        <MetricCard label="Tracked companies" value={String(companies.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Stage distribution</CardTitle>
            <CardDescription>Current stage counts for the selected filters.</CardDescription>
          </CardHeader>
          {stageCounts.length === 0 ? (
            <EmptyState title="No stage data yet" description="Create or import deals to populate stage reporting." />
          ) : (
            <ul className="space-y-3">
              {stageCounts.map(([stage, count]) => (
                <li key={stage} className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2">
                  <span className="text-sm text-neutral-700">{stage}</span>
                  <StatusBadge value={String(count)} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Deals included in report</CardTitle>
            <CardDescription>Use this as a drill-down table before export.</CardDescription>
          </CardHeader>
          {filteredDeals.length === 0 ? (
            <EmptyState title="No matching deals" description="Try widening your date range or status filter." />
          ) : (
            <DataTable
              columns={[
                {
                  key: 'deal',
                  header: 'Deal',
                  cell: (deal) => <p className="font-medium text-neutral-900">{deal.name}</p>,
                },
                {
                  key: 'stage',
                  header: 'Stage',
                  cell: (deal) => deal.stage,
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  cell: (deal) => formatUsd(deal.amount),
                },
                {
                  key: 'company',
                  header: 'Company',
                  cell: (deal) => companyNameById.get(deal.company_id) ?? 'Unassigned',
                },
                {
                  key: 'contact',
                  header: 'Contact',
                  cell: (deal) => contactNameById.get(deal.contact_id) ?? 'Unassigned',
                },
              ]}
              rows={filteredDeals}
              emptyTitle="No matching deals"
              emptyDescription="Try widening your date range or status filter."
              onRowClick={(deal) => navigate(`/deals/${deal.id}`)}
              rowActions={(deal) => [
                {
                  label: 'Open details',
                  shortcut: 'Enter',
                  onSelect: () => navigate(`/deals/${deal.id}`),
                },
                {
                  label: getStageFilterLabel(deal.stage),
                  onSelect: () => setStageFilter(getStageFilterTarget(deal.stage)),
                },
                {
                  label: 'Copy deal ID',
                  icon: <Copy className="h-4 w-4" />,
                  onSelect: () => {
                    void copyToClipboard(deal.id)
                  },
                },
              ]}
            />
          )}
        </Card>
      </div>
    </section>
  )
}
