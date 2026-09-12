import { apiRequest } from "@/src/lib/api";

export type SavedViewEntityType = 'contacts' | 'companies' | 'deals'
const CUSTOM_SAVED_VIEW_PREFIX = 'custom-'
const MAX_SAVED_VIEW_KEY_LENGTH = 64

export type SavedViewRecord = {
  id: string
  owner_id: string
  entity_type: SavedViewEntityType
  view_key: string
  label: string
  criteria: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function listSavedViews(entityType: SavedViewEntityType, token?: string | null) {
  return apiRequest<SavedViewRecord[]>(`/api/saved-views/${entityType}`, { token })
}

export async function upsertSavedView(
  entityType: SavedViewEntityType,
  viewKey: string,
  payload: {
    label: string
    criteria: Record<string, unknown>
  },
  token?: string | null,
) {
  return apiRequest<SavedViewRecord>(`/api/saved-views/${entityType}/${viewKey}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
}

export function normalizeSavedViewLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ')
}

function toSavedViewSlug(label: string) {
  return normalizeSavedViewLabel(label)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildKeyCandidate(base: string, suffix: string) {
  const maxBaseLength = MAX_SAVED_VIEW_KEY_LENGTH - CUSTOM_SAVED_VIEW_PREFIX.length - suffix.length
  const trimmedBase = base.slice(0, Math.max(maxBaseLength, 1)).replace(/-+$/g, '') || 'view'
  return `${CUSTOM_SAVED_VIEW_PREFIX}${trimmedBase}${suffix}`
}

export function buildCustomSavedViewKey(
  label: string,
  existingKeys: Iterable<string>,
  currentKey?: string | null,
) {
  if (currentKey) {
    return currentKey
  }

  const knownKeys = new Set(existingKeys)
  const slug = toSavedViewSlug(label) || 'view'

  let attempt = 0
  while (attempt < 1000) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const candidate = buildKeyCandidate(slug, suffix)
    if (!knownKeys.has(candidate)) {
      return candidate
    }
    attempt += 1
  }

  return buildKeyCandidate(`view-${Date.now()}`, '')
}
