import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { apiRequest } from '../../lib/api.js'
import type { Company, Contact, Deal } from '../../types/entities.js'
import { Button } from '../layout/ui/button.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../layout/ui/dialog.js'
import { Input } from '../layout/ui/input.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../layout/ui/tabs.js'
import { Textarea } from '../layout/ui/textarea.js'

type QuickAddTab = 'contact' | 'deal' | 'task'

type CreateContactPayload = {
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  company_id?: string | null
  status?: string
}

type CreateDealPayload = {
  name: string
  amount: number
  stage?: string
  company_id: string
  contact_id: string
  expected_close_date?: string | null
}

type CreateCompanyPayload = {
  name: string
  website?: string | null
  industry?: string | null
}

type InlineCompanyTarget = 'contact' | 'deal'

const EMPTY_COMPANIES: Company[] = []
const EMPTY_CONTACTS: Contact[] = []
const QUICK_ADD_LAST_COMPANY_KEY = 'soapcrm.quick_add.last_company_id'
const QUICK_ADD_LAST_CONTACT_KEY = 'soapcrm.quick_add.last_contact_id'

/**
 * Lightweight modal for creating common records without navigating away.
 */
export function QuickAddDialog() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<QuickAddTab>('contact')
  const [error, setError] = useState<string | null>(null)

  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactCompanyId, setContactCompanyId] = useState('')
  const [contactNewCompanyName, setContactNewCompanyName] = useState('')

  const [dealName, setDealName] = useState('')
  const [dealAmount, setDealAmount] = useState('')
  const [dealCompanyId, setDealCompanyId] = useState('')
  const [dealContactId, setDealContactId] = useState('')
  const [dealNewCompanyName, setDealNewCompanyName] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskNotes, setTaskNotes] = useState('')

  const companiesQuery = useQuery({
    queryKey: ['companies', token],
    queryFn: () => apiRequest<Company[]>('/api/companies', { token }),
    enabled: open && Boolean(token),
  })
  const contactsQuery = useQuery({
    queryKey: ['contacts', token],
    queryFn: () => apiRequest<Contact[]>('/api/contacts', { token }),
    enabled: open && Boolean(token),
  })

  const companies = companiesQuery.data ?? EMPTY_COMPANIES
  const contacts = contactsQuery.data ?? EMPTY_CONTACTS

  const rememberedCompanyId = useMemo(() => {
    if (!open || activeTab !== 'deal') {
      return ''
    }
    const lastCompanyId = window.localStorage.getItem(QUICK_ADD_LAST_COMPANY_KEY)
    if (lastCompanyId && companies.some((company) => company.id === lastCompanyId)) {
      return lastCompanyId
    }
    return ''
  }, [activeTab, companies, open])

  const effectiveDealCompanyId = useMemo(() => {
    if (dealCompanyId) {
      return dealCompanyId
    }
    if (rememberedCompanyId) {
      return rememberedCompanyId
    }
    if (companies.length === 1) {
      return companies[0]?.id ?? ''
    }
    return ''
  }, [companies, dealCompanyId, rememberedCompanyId])

  const dealContacts = useMemo(() => {
    // Deal creation requires contact/company alignment, so list only valid contacts.
    return contacts.filter((contact) => contact.company_id === effectiveDealCompanyId)
  }, [contacts, effectiveDealCompanyId])

  const rememberedContactId = useMemo(() => {
    if (!open || activeTab !== 'deal') {
      return ''
    }
    const lastContactId = window.localStorage.getItem(QUICK_ADD_LAST_CONTACT_KEY)
    if (lastContactId && dealContacts.some((contact) => contact.id === lastContactId)) {
      return lastContactId
    }
    return ''
  }, [activeTab, dealContacts, open])

  const effectiveDealContactId = useMemo(() => {
    if (dealContactId) {
      return dealContactId
    }
    if (rememberedContactId) {
      return rememberedContactId
    }
    if (dealContacts.length === 1) {
      return dealContacts[0]?.id ?? ''
    }
    return ''
  }, [dealContactId, dealContacts, rememberedContactId])

  const createContactMutation = useMutation({
    mutationFn: (payload: CreateContactPayload) =>
      apiRequest<Contact>('/api/contacts', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setContactFirstName('')
      setContactLastName('')
      setContactEmail('')
      setContactPhone('')
      setContactCompanyId('')
      setError(null)
      setOpen(false)
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message)
    },
  })

  const createDealMutation = useMutation({
    mutationFn: (payload: CreateDealPayload) =>
      apiRequest<Deal>('/api/deals', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['deals'] }),
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
      ])
      if (effectiveDealCompanyId) {
        window.localStorage.setItem(QUICK_ADD_LAST_COMPANY_KEY, effectiveDealCompanyId)
      }
      if (effectiveDealContactId) {
        window.localStorage.setItem(QUICK_ADD_LAST_CONTACT_KEY, effectiveDealContactId)
      }
      setDealName('')
      setDealAmount('')
      setDealCompanyId('')
      setDealContactId('')
      setError(null)
      setOpen(false)
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message)
    },
  })

  const createCompanyMutation = useMutation({
    mutationFn: ({ payload }: { payload: CreateCompanyPayload; target: InlineCompanyTarget }) =>
      apiRequest<Company>('/api/companies', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: async (createdCompany, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      if (variables.target === 'contact') {
        setContactCompanyId(createdCompany.id)
        setContactNewCompanyName('')
      } else {
        setDealCompanyId(createdCompany.id)
        setDealContactId('')
        setDealNewCompanyName('')
        window.localStorage.setItem(QUICK_ADD_LAST_COMPANY_KEY, createdCompany.id)
      }
      setError(null)
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message)
    },
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!token) {
      setError('You are not signed in. Sign in again and retry.')
      return
    }

    if (activeTab === 'contact') {
      if (!contactFirstName.trim() || !contactLastName.trim()) {
        setError('First and last name are required.')
        return
      }

      await createContactMutation.mutateAsync({
        first_name: contactFirstName.trim(),
        last_name: contactLastName.trim(),
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        company_id: contactCompanyId || null,
        status: 'lead',
      })
      return
    }

    if (activeTab === 'deal') {
      const amount = Number(dealAmount.replaceAll(',', '').trim())
      if (!dealName.trim()) {
        setError('Deal name is required.')
        return
      }
      if (!Number.isFinite(amount) || amount < 0) {
        setError('Amount must be zero or greater.')
        return
      }
      if (!effectiveDealCompanyId) {
        setError('Select a company for this deal.')
        return
      }
      if (!effectiveDealContactId) {
        setError('Select a contact from that company.')
        return
      }

      await createDealMutation.mutateAsync({
        name: dealName.trim(),
        amount,
        stage: 'Prospecting',
        company_id: effectiveDealCompanyId,
        contact_id: effectiveDealContactId,
        expected_close_date: null,
      })
      return
    }

    setError('Tasks quick add is not available yet.')
  }

  function resolvePrimaryActionLabel() {
    if (activeTab === 'contact') {
      return createContactMutation.isPending ? 'Creating contact...' : 'Create contact'
    }
    if (activeTab === 'deal') {
      return createDealMutation.isPending ? 'Creating deal...' : 'Create deal'
    }
    return 'Tasks coming soon'
  }

  async function handleInlineCompanyCreate(target: InlineCompanyTarget) {
    const candidateName = target === 'contact' ? contactNewCompanyName : dealNewCompanyName
    const trimmedName = candidateName.trim()
    if (!trimmedName) {
      setError('Enter a company name before creating.')
      return
    }

    setError(null)
    await createCompanyMutation.mutateAsync({
      target,
      payload: {
        name: trimmedName,
        website: null,
        industry: null,
      },
    })
  }

  const isBusy =
    createContactMutation.isPending || createDealMutation.isPending || createCompanyMutation.isPending
  const isTaskTab = activeTab === 'task'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Quick add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add</DialogTitle>
          <DialogDescription>
            Create a contact or deal without leaving your current screen.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as QuickAddTab)}>
            <TabsList className="grid w-full grid-cols-3 rounded-xl border border-neutral-200 bg-neutral-100 p-1">
              <TabsTrigger
                value="contact"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                Contact
              </TabsTrigger>
              <TabsTrigger
                value="deal"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                Deal
              </TabsTrigger>
              <TabsTrigger
                value="task"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                Task
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  placeholder="First name"
                  value={contactFirstName}
                  onChange={(event) => setContactFirstName(event.target.value)}
                />
                <Input
                  placeholder="Last name"
                  value={contactLastName}
                  onChange={(event) => setContactLastName(event.target.value)}
                />
              </div>
              <Input
                placeholder="Email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
              <Input
                placeholder="Phone (optional)"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
              <select
                value={contactCompanyId}
                onChange={(event) => setContactCompanyId(event.target.value)}
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
                  aria-label="Create and link company"
                  value={contactNewCompanyName}
                  onChange={(event) => setContactNewCompanyName(event.target.value)}
                  placeholder="Create and link company"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleInlineCompanyCreate('contact')}
                  disabled={createCompanyMutation.isPending}
                >
                  {createCompanyMutation.isPending && activeTab === 'contact' ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="deal" className="space-y-3">
              <Input placeholder="Deal name" value={dealName} onChange={(event) => setDealName(event.target.value)} />
              <Input
                placeholder="Amount (USD)"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={dealAmount}
                onChange={(event) => setDealAmount(event.target.value)}
              />
              <select
                value={effectiveDealCompanyId}
                onChange={(event) => {
                  setDealCompanyId(event.target.value)
                  setDealContactId('')
                  if (event.target.value) {
                    window.localStorage.setItem(QUICK_ADD_LAST_COMPANY_KEY, event.target.value)
                  }
                }}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Create and link company"
                  value={dealNewCompanyName}
                  onChange={(event) => setDealNewCompanyName(event.target.value)}
                  placeholder="Create and link company"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleInlineCompanyCreate('deal')}
                  disabled={createCompanyMutation.isPending}
                >
                  {createCompanyMutation.isPending && activeTab === 'deal' ? 'Creating...' : 'Create'}
                </Button>
              </div>
              <select
                value={effectiveDealContactId}
                onChange={(event) => setDealContactId(event.target.value)}
                disabled={!effectiveDealCompanyId}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
              >
                <option value="">{effectiveDealCompanyId ? 'Select contact' : 'Select company first'}</option>
                {dealContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))}
              </select>
              {effectiveDealCompanyId && dealContacts.length === 0 ? (
                <p className="text-xs text-neutral-600">
                  No contacts are linked to this company yet. Create a contact first, then return to this deal.
                </p>
              ) : null}
              {companies.length === 0 ? (
                <p className="text-xs text-neutral-600">
                  No companies yet. Create one above or add one on the{' '}
                  <Link to="/companies" className="font-medium text-emerald-700 underline-offset-4 hover:underline">
                    Companies page
                  </Link>
                  .
                </p>
              ) : null}
            </TabsContent>
            <TabsContent value="task" className="space-y-3">
              <Input
                placeholder="Task title"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                disabled
              />
              <Textarea
                placeholder="Task notes"
                value={taskNotes}
                onChange={(event) => setTaskNotes(event.target.value)}
                disabled
              />
              <p className="text-xs text-neutral-600">
                Task quick add will be enabled after task APIs ship.
              </p>
            </TabsContent>
          </Tabs>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy || isTaskTab || companiesQuery.isLoading || contactsQuery.isLoading}>
              {resolvePrimaryActionLabel()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
