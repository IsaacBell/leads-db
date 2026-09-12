import { apiRequest } from "@/src/lib/api";

export type DuplicateEntityType = 'contacts' | 'companies'

export type DuplicateCandidateRecord = {
  entity_type: DuplicateEntityType
  reason: string
  primary_id: string
  duplicate_id: string
  primary_label: string
  duplicate_label: string
}

export type MergeDuplicateResponse = {
  entity_type: DuplicateEntityType
  source_id: string
  target_id: string
  moved_contacts: number
  moved_deals: number
  moved_activities: number
  deleted_source: boolean
}

export async function listDuplicates(entityType: DuplicateEntityType, token?: string | null) {
  return apiRequest<DuplicateCandidateRecord[]>(`/api/duplicates/${entityType}`, { token })
}

export async function mergeDuplicate(
  entityType: DuplicateEntityType,
  payload: {
    source_id: string
    target_id: string
  },
  token?: string | null,
) {
  return apiRequest<MergeDuplicateResponse>(`/api/duplicates/${entityType}/merge`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export function formatDuplicateReason(reason: string) {
  switch (reason) {
    case 'email_exact':
      return 'Same email'
    case 'phone_exact':
      return 'Same phone'
    case 'name_exact':
      return 'Same company name'
    default:
      return 'Possible duplicate'
  }
}
