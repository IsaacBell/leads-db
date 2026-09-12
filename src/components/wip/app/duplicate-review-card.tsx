import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import { Badge } from "@/src/components/wip/layout/ui/badge"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/wip/layout/ui/dialog"
import { ApiError } from '@/src/lib/api'
import {
  formatDuplicateReason,
  listDuplicates,
  mergeDuplicate,
  type DuplicateCandidateRecord,
  type DuplicateEntityType,
} from '@/src/lib/duplicates'

type DuplicateReviewCardProps = {
  entityType: DuplicateEntityType
  title: string
  description: string
  token: string | null
  invalidateQueryKeys: ReadonlyArray<QueryKey>
}

function buildMergeSuccessMessage(candidate: DuplicateCandidateRecord, entityType: DuplicateEntityType, result: {
  target_id: string
  moved_contacts: number
  moved_deals: number
  moved_activities: number
}) {
  const canonicalLabel =
    result.target_id === candidate.primary_id ? candidate.primary_label : candidate.duplicate_label
  const movedSummary: string[] = []
  if (entityType === 'companies' && result.moved_contacts > 0) {
    movedSummary.push(`${result.moved_contacts} linked contact${result.moved_contacts === 1 ? '' : 's'}`)
  }
  if (result.moved_deals > 0) {
    movedSummary.push(`${result.moved_deals} deal${result.moved_deals === 1 ? '' : 's'}`)
  }
  if (result.moved_activities > 0) {
    movedSummary.push(`${result.moved_activities} activit${result.moved_activities === 1 ? 'y' : 'ies'}`)
  }

  if (movedSummary.length === 0) {
    return `Merged duplicate records into ${canonicalLabel}.`
  }

  return `Merged duplicate records into ${canonicalLabel}. Re-linked ${movedSummary.join(', ')}.`
}

export function DuplicateReviewCard({
  entityType,
  title,
  description,
  token,
  invalidateQueryKeys,
}: DuplicateReviewCardProps) {
  const queryClient = useQueryClient()
  const [selectedCandidate, setSelectedCandidate] = useState<DuplicateCandidateRecord | null>(null)
  const [canonicalId, setCanonicalId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const duplicatesQuery = useQuery({
    queryKey: ['duplicates', entityType, token],
    queryFn: () => listDuplicates(entityType, token),
    enabled: Boolean(token),
  })

  const mergeDuplicateMutation = useMutation({
    mutationFn: async (candidate: DuplicateCandidateRecord) => {
      const targetId = canonicalId === candidate.duplicate_id ? candidate.duplicate_id : candidate.primary_id
      const sourceId = targetId === candidate.primary_id ? candidate.duplicate_id : candidate.primary_id
      return mergeDuplicate(
        entityType,
        {
          source_id: sourceId,
          target_id: targetId,
        },
        token,
      )
    },
    onSuccess: async (result, candidate) => {
      for (const queryKey of invalidateQueryKeys) {
        await queryClient.invalidateQueries({ queryKey })
      }
      await queryClient.invalidateQueries({ queryKey: ['duplicates', entityType] })
      setFeedbackMessage(buildMergeSuccessMessage(candidate, entityType, result))
      setDialogError(null)
      setSelectedCandidate(null)
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        setDialogError(error.message)
        return
      }
      setDialogError('Unable to merge these records right now.')
    },
  })

  useEffect(() => {
    if (!selectedCandidate) {
      return
    }

    // Default to the first candidate so the operator always has a clear safe target.
    setCanonicalId(selectedCandidate.primary_id)
    setDialogError(null)
  }, [selectedCandidate])

  const duplicates = duplicatesQuery.data ?? []
  const totalPairs = duplicates.length
  const groupedReasonSummary = useMemo(() => {
    const reasonCounts = new Map<string, number>()
    for (const candidate of duplicates) {
      reasonCounts.set(candidate.reason, (reasonCounts.get(candidate.reason) ?? 0) + 1)
    }
    return [...reasonCounts.entries()]
      .map(([reason, count]) => `${count} ${formatDuplicateReason(reason).toLowerCase()}`)
      .join(' • ')
  }, [duplicates])

  function openReviewDialog(candidate: DuplicateCandidateRecord) {
    setFeedbackMessage(null)
    setSelectedCandidate(candidate)
  }

  async function handleMergeSelection() {
    if (!selectedCandidate) {
      return
    }
    await mergeDuplicateMutation.mutateAsync(selectedCandidate)
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Badge variant="neutral" className="rounded-full px-3 py-1">
              {totalPairs} open
            </Badge>
          </div>

          {feedbackMessage ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
              {feedbackMessage}
            </p>
          ) : null}

          {duplicatesQuery.isLoading ? (
            <p className="text-sm text-neutral-500">Checking for likely duplicate records…</p>
          ) : null}

          {duplicatesQuery.isError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {(duplicatesQuery.error as Error).message}
            </p>
          ) : null}

          {!duplicatesQuery.isLoading && !duplicatesQuery.isError && totalPairs === 0 ? (
            <p className="text-sm text-neutral-500">No likely duplicates are waiting for review right now.</p>
          ) : null}

          {!duplicatesQuery.isLoading && !duplicatesQuery.isError && totalPairs > 0 ? (
            <>
              <p className="text-sm text-neutral-500">{groupedReasonSummary}</p>
              <div className="space-y-3">
                {duplicates.map((candidate) => (
                  <div
                    key={`${candidate.primary_id}:${candidate.duplicate_id}:${candidate.reason}`}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral" className="rounded-full">
                        {formatDuplicateReason(candidate.reason)}
                      </Badge>
                      <span className="text-xs text-neutral-500">Review before the records drift further apart.</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <div className="rounded-xl border border-white bg-white px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Record A</p>
                        <p className="text-sm font-medium text-neutral-900">{candidate.primary_label}</p>
                      </div>
                      <div className="flex items-center justify-center text-neutral-400">
                        <ArrowRightLeft className="h-4 w-4" />
                      </div>
                      <div className="rounded-xl border border-white bg-white px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Record B</p>
                        <p className="text-sm font-medium text-neutral-900">{candidate.duplicate_label}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button type="button" size="sm" variant="outline" onClick={() => openReviewDialog(candidate)}>
                        Review merge
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </CardHeader>
      </Card>

      <Dialog
        open={Boolean(selectedCandidate)}
        onOpenChange={(open) => {
          if (!open && !mergeDuplicateMutation.isPending) {
            setSelectedCandidate(null)
            setDialogError(null)
          }
        }}
      >
        <DialogContent>
          {selectedCandidate ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Review duplicate merge</DialogTitle>
                <DialogDescription>
                  Choose which record to keep as the canonical version, then merge the other one into it.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {[selectedCandidate.primary_id, selectedCandidate.duplicate_id].map((candidateId, index) => {
                  const isSelected = canonicalId === candidateId
                  const label =
                    candidateId === selectedCandidate.primary_id
                      ? selectedCandidate.primary_label
                      : selectedCandidate.duplicate_label
                  return (
                    <button
                      key={candidateId}
                      type="button"
                      onClick={() => setCanonicalId(candidateId)}
                      className={[
                        'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                            {index === 0 ? 'Record A' : 'Record B'}
                          </p>
                          <p className="text-sm font-medium">{label}</p>
                        </div>
                        {isSelected ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : null}
                      </div>
                      <p className="mt-2 text-xs text-neutral-500">
                        {isSelected ? 'This record will remain after merge.' : 'Merge this record into the selected one.'}
                      </p>
                    </button>
                  )
                })}
              </div>

              {dialogError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                  {dialogError}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedCandidate(null)}
                  disabled={mergeDuplicateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleMergeSelection()} disabled={mergeDuplicateMutation.isPending}>
                  {mergeDuplicateMutation.isPending ? 'Merging...' : 'Merge records'}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
