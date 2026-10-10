export type Company = {
  id: string
  name: string
  website: string | null
  industry: string | null
  owner_id: string
  created_at: string
}

export type Contact = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_id: string | null
  status: string
  owner_id: string
  created_at: string
}

export type Deal = {
  id: string
  name: string
  amount: number
  stage: string
  company_id: string
  contact_id: string
  owner_id: string
  expected_close_date: string | null
  created_at: string
}

export type Activity = {
  id: string
  type: 'note' | 'call' | 'email' | 'meeting'
  description: string
  due_date: string | null
  contact_id: string | null
  deal_id: string | null
  user_id: string
  created_at: string
}

export type Task = {
  id: string
  title: string
  details: string | null
  status: 'todo' | 'in_progress' | 'done' | 'canceled'
  due_date: string | null
  contact_id: string | null
  deal_id: string | null
  owner_id: string
  created_at: string
  completed_at: string | null
}
