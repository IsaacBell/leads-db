/* WIP */
import { captureAnalyticsEvent } from "@/src/lib/analytics";

const DEFAULT_API_BASE_URL = 'http://localhost:3000'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/$/, '')

type RequestOptions = Omit<RequestInit, 'headers'> & {
  token?: string | null
  headers?: Record<string, string>
}

type ErrorBody = {
  error?: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, headers, ...fetchOptions } = options
  const method = fetchOptions.method?.toUpperCase() || 'GET'
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as ErrorBody
      if (body.error) {
        message = body.error
      }
    } catch {
      // Ignore parse errors and keep status-based message.
    }

    throw new ApiError(response.status, message)
  }

  const responseBody = (await response.json()) as T
  trackAnalyticsForSuccessfulMutation(path, method, fetchOptions.body, responseBody)
  return responseBody
}

function trackAnalyticsForSuccessfulMutation<T>(
  path: string,
  method: string,
  body: RequestInit['body'] | undefined,
  responseBody: T,
) {
  const parsedBody = parseJsonBody(body)
  const mutationEvent = resolveAnalyticsMutationEvent(path, method)
  if (!mutationEvent) {
    return
  }

  if (mutationEvent === 'contact_created') {
    captureAnalyticsEvent('contact_created', {
      source: 'api',
      has_company: Boolean(parsedBody?.company_id),
      status: typeof parsedBody?.status === 'string' ? parsedBody.status : 'lead',
    })
    return
  }

  if (mutationEvent === 'company_created') {
    captureAnalyticsEvent('company_created', {
      source: 'api',
      has_website: Boolean(parsedBody?.website),
      has_industry: Boolean(parsedBody?.industry),
    })
    return
  }

  if (mutationEvent === 'deal_created') {
    captureAnalyticsEvent('deal_created', {
      source: 'api',
      stage: typeof parsedBody?.stage === 'string' ? parsedBody.stage : 'Prospecting',
      has_expected_close_date: Boolean(parsedBody?.expected_close_date),
    })
    return
  }

  if (mutationEvent === 'deal_stage_changed') {
    if (typeof parsedBody?.stage !== 'string') {
      return
    }
    const responseId = extractEntityId(responseBody)
    captureAnalyticsEvent('deal_stage_changed', {
      source: 'api',
      stage: parsedBody.stage,
      has_deal_id: Boolean(responseId),
    })
    return
  }

  if (parsedBody?.status === 'complete' || parsedBody?.completed === true) {
    captureAnalyticsEvent('task_completed', {
      source: 'api',
    })
  }
}

type MutationEvent =
  | 'contact_created'
  | 'company_created'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'task_completed'

function resolveAnalyticsMutationEvent(path: string, method: string): MutationEvent | null {
  if (method === 'POST') {
    if (path === '/api/contacts') {
      return 'contact_created'
    }
    if (path === '/api/companies') {
      return 'company_created'
    }
    if (path === '/api/deals') {
      return 'deal_created'
    }
    return null
  }

  if (method === 'PATCH' && path.startsWith('/api/deals/')) {
    return 'deal_stage_changed'
  }

  if (method === 'PATCH' && path.startsWith('/api/tasks/')) {
    return 'task_completed'
  }

  return null
}

function parseJsonBody(body: RequestInit['body'] | undefined) {
  if (typeof body !== 'string') {
    return null
  }

  try {
    return JSON.parse(body) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractEntityId(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== 'object') {
    return null
  }

  const candidate = (responseBody as Record<string, unknown>).id
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate
  }

  return null
}
