/* WIP - may move to matomo */
import type { User } from '../types/auth.ts'

type RuntimeProfile = 'minimal' | 'analytics-only' | 'observability-only' | 'full-stack'
type AnalyticsProvider = 'posthog'
type AnalyticsDisabledReason = 'missing_posthog_key' | 'profile_disabled' | null

export type AnalyticsEventName =
  | 'page_view'
  | 'auth_login_succeeded'
  | 'auth_register_succeeded'
  | 'auth_logout'
  | 'contact_created'
  | 'company_created'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'task_completed'

type AnalyticsValue = string | number | boolean | null

type AnalyticsProperties = Record<string, AnalyticsValue>

type PostHogEventPayload = {
  api_key: string
  event: AnalyticsEventName | '$identify'
  distinct_id: string
  properties: Record<string, AnalyticsValue>
  timestamp: string
}

const ANALYTICS_CONSENT_KEY = 'soapcrm.analytics.cookies_consent'
const ANALYTICS_ANON_ID_KEY = 'soapcrm.analytics.anon_id'
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'
const POSTHOG_PROJECT_TOKEN = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim()
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/$/, '')
const PROFILE = (import.meta.env.VITE_RUNTIME_PROFILE?.trim() || 'full-stack') as RuntimeProfile

const analyticsEnabledByProfile = PROFILE === 'analytics-only' || PROFILE === 'full-stack'
const posthogConfigured = Boolean(POSTHOG_PROJECT_TOKEN)
const analyticsEnabled = posthogConfigured && analyticsEnabledByProfile
const analyticsDisabledReason: AnalyticsDisabledReason = (() => {
  if (posthogConfigured === false) {
    return 'missing_posthog_key'
  }
  if (analyticsEnabledByProfile === false) {
    return 'profile_disabled'
  }
  return null
})()

let initialized = false
let currentDistinctId: string | null = null

function getLocalStorage() {
  if (globalThis.localStorage === undefined) {
    return null
  }

  return globalThis.localStorage
}

function getStoredConsent(): boolean {
  const storage = getLocalStorage()
  if (!storage) {
    return false
  }

  const stored = storage.getItem(ANALYTICS_CONSENT_KEY)
  if (stored === null) {
    return true
  }

  return stored === 'true'
}

function getOrCreateAnonymousId() {
  const storage = getLocalStorage()
  if (!storage) {
    return `anon-${Date.now()}`
  }

  const existing = storage.getItem(ANALYTICS_ANON_ID_KEY)
  if (existing) {
    return existing
  }

  const generated = globalThis.crypto?.randomUUID?.() || `anon-${Date.now()}`
  storage.setItem(ANALYTICS_ANON_ID_KEY, generated)
  return generated
}

function normalizeProperties(properties: AnalyticsProperties): AnalyticsProperties {
  const normalizedEntries = Object.entries(properties)
    .filter(([key]) => key.length > 0)
    .slice(0, 20)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, value.slice(0, 512)] as const
      }

      return [key, value] as const
    })

  return Object.fromEntries(normalizedEntries)
}

function buildEventPayload(
  event: AnalyticsEventName | '$identify',
  projectToken: string,
  distinctId: string,
  properties: AnalyticsProperties,
): PostHogEventPayload {
  return {
    api_key: projectToken,
    event,
    distinct_id: distinctId,
    properties: normalizeProperties({
      ...properties,
      $lib: 'soapcrm-frontend',
      runtime_profile: PROFILE,
    }),
    timestamp: new Date().toISOString(),
  }
}

function canSendEvents() {
  return analyticsEnabled && initialized && getStoredConsent()
}

async function postEvent(payload: PostHogEventPayload) {
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Analytics is intentionally best-effort and must never block CRM workflows.
  }
}

export function initAnalytics() {
  if (initialized) {
    return
  }

  if (!analyticsEnabled) {
    currentDistinctId = null
    return
  }

  currentDistinctId = getOrCreateAnonymousId()
  initialized = true
}

export function setAnalyticsConsent(value: boolean) {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }

  storage.setItem(ANALYTICS_CONSENT_KEY, String(value))
}

export function getAnalyticsConsent() {
  return getStoredConsent()
}

export function identifyAnalyticsUser(user: User) {
  if (!canSendEvents() || !POSTHOG_PROJECT_TOKEN) {
    return
  }

  const anonymousId = getOrCreateAnonymousId()
  currentDistinctId = user.id

  void postEvent(
    buildEventPayload('$identify', POSTHOG_PROJECT_TOKEN, user.id, {
      $anon_distinct_id: anonymousId,
      email_domain: user.email.split('@')[1] || 'unknown',
      user_role: user.role,
    }),
  )
}

export function resetAnalyticsIdentity() {
  if (!analyticsEnabled) {
    return
  }

  currentDistinctId = getOrCreateAnonymousId()
}

export function captureAnalyticsEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!canSendEvents() || !POSTHOG_PROJECT_TOKEN) {
    return
  }

  const distinctId = currentDistinctId || getOrCreateAnonymousId()
  currentDistinctId = distinctId

  void postEvent(buildEventPayload(event, POSTHOG_PROJECT_TOKEN, distinctId, properties))
}

export type AnalyticsRuntimeInfo = {
  provider: AnalyticsProvider
  enabled: boolean
  profile: RuntimeProfile
  host: string
  posthogConfigured: boolean
  disabledReason: AnalyticsDisabledReason
}

export function getAnalyticsRuntimeInfo(): AnalyticsRuntimeInfo {
  return {
    provider: 'posthog',
    enabled: analyticsEnabled,
    profile: PROFILE,
    host: POSTHOG_HOST,
    posthogConfigured,
    disabledReason: analyticsDisabledReason,
  }
}
