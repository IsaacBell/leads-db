import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal } from 'lucide-react'
import type { Deal } from '../../types/entities.js'
import { Badge } from '../layout/ui/badge.js'
import { Button } from '../layout/ui/button.js'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../layout/ui/context-menu.js'
import { StatusBadge } from './status-badge.js'

export const PIPELINE_STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Won', 'Lost'] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

type DealPipelineBoardProps = {
  deals: Deal[]
  companyNameById: Map<string, string>
  contactNameById: Map<string, string>
  onOpenDeal: (deal: Deal) => void
  onMoveDealStage: (deal: Deal, stage: PipelineStage) => void
  onCopyDealId: (dealId: string) => void
  isBusy?: boolean
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function PipelineColumn({
  stage,
  deals,
  companyNameById,
  contactNameById,
  onOpenDeal,
  onMoveDealStage,
  onCopyDealId,
}: {
  stage: PipelineStage
  deals: Deal[]
  companyNameById: Map<string, string>
  contactNameById: Map<string, string>
  onOpenDeal: (deal: Deal) => void
  onMoveDealStage: (deal: Deal, stage: PipelineStage) => void
  onCopyDealId: (dealId: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage })

  return (
    <section
      ref={setNodeRef}
      data-testid={`pipeline-column-${stage.toLowerCase()}`}
      className={`rounded-2xl border bg-white p-3 transition-colors ${
        isOver ? 'border-emerald-300 bg-emerald-50/40' : 'border-neutral-200'
      }`}
    >
      <header className="mb-3 flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-medium text-neutral-900">{stage}</p>
        <Badge variant="neutral" className="rounded-full">
          {deals.length}
        </Badge>
      </header>

      <div className="space-y-2">
        {deals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-500">
            Drop a deal here
          </p>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              companyNameById={companyNameById}
              contactNameById={contactNameById}
              onOpenDeal={onOpenDeal}
              onMoveDealStage={onMoveDealStage}
              onCopyDealId={onCopyDealId}
            />
          ))
        )}
      </div>
    </section>
  )
}

function DealCard({
  deal,
  companyNameById,
  contactNameById,
  onOpenDeal,
  onMoveDealStage,
  onCopyDealId,
}: {
  deal: Deal
  companyNameById: Map<string, string>
  contactNameById: Map<string, string>
  onOpenDeal: (deal: Deal) => void
  onMoveDealStage: (deal: Deal, stage: PipelineStage) => void
  onCopyDealId: (dealId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { dealId: deal.id },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          ref={setNodeRef}
          style={style}
          data-testid={`pipeline-deal-${deal.id}`}
          className={`rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-neutral-300 ${
            isDragging ? 'z-10 opacity-70' : ''
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <button
              type="button"
              className="text-left"
              onClick={() => onOpenDeal(deal)}
              aria-label={`Open deal ${deal.name}`}
            >
              <p className="text-sm font-medium text-neutral-900">{deal.name}</p>
            </button>
            <button
              type="button"
              className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label={`Drag ${deal.name}`}
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm font-semibold text-neutral-900">{formatUsd(deal.amount)}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <StatusBadge value={deal.stage} />
            <Button variant="ghost" size="sm" onClick={() => onOpenDeal(deal)}>
              <MoreHorizontal className="h-4 w-4" />
              Open
            </Button>
          </div>

          <dl className="mt-2 space-y-1 text-xs text-neutral-600">
            <div className="flex items-center justify-between gap-2">
              <dt>Company</dt>
              <dd className="truncate text-neutral-700">{companyNameById.get(deal.company_id) ?? 'Unassigned'}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Contact</dt>
              <dd className="truncate text-neutral-700">{contactNameById.get(deal.contact_id) ?? 'Unassigned'}</dd>
            </div>
          </dl>
        </article>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuLabel>Deal actions</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onOpenDeal(deal)}>Open details</ContextMenuItem>
        <ContextMenuItem onSelect={() => onCopyDealId(deal.id)}>Copy deal ID</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to stage</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {PIPELINE_STAGES.map((stage) => (
              <ContextMenuItem
                key={stage}
                disabled={deal.stage === stage}
                onSelect={() => onMoveDealStage(deal, stage)}
              >
                {stage}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function DealPipelineBoard({
  deals,
  companyNameById,
  contactNameById,
  onOpenDeal,
  onMoveDealStage,
  onCopyDealId,
  isBusy = false,
}: DealPipelineBoardProps) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  const dealsByStage = useMemo(() => {
    const initial = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, [] as Deal[]])) as Record<
      PipelineStage,
      Deal[]
    >

    for (const deal of deals) {
      const stage = PIPELINE_STAGES.includes(deal.stage as PipelineStage)
        ? (deal.stage as PipelineStage)
        : 'Prospecting'
      initial[stage].push(deal)
    }

    return initial
  }, [deals])

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const dealId = String(event.active.id)
    const nextStage = event.over?.id
    setActiveDealId(null)

    if (!nextStage || typeof nextStage !== 'string') {
      return
    }

    if (!PIPELINE_STAGES.includes(nextStage as PipelineStage)) {
      return
    }

    const deal = deals.find((entry) => entry.id === dealId)
    if (!deal) {
      return
    }

    const normalizedStage = nextStage as PipelineStage
    if (deal.stage === normalizedStage) {
      return
    }

    onMoveDealStage(deal, normalizedStage)
  }

  return (
    <div data-testid="deal-pipeline-board" className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">Drag deals between stages or use right-click for quick stage updates.</p>
        {isBusy ? <p className="text-xs text-neutral-500">Updating stage...</p> : null}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PIPELINE_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              deals={dealsByStage[stage]}
              companyNameById={companyNameById}
              contactNameById={contactNameById}
              onOpenDeal={onOpenDeal}
              onMoveDealStage={onMoveDealStage}
              onCopyDealId={onCopyDealId}
            />
          ))}
        </div>
      </DndContext>

      {activeDealId ? <p className="text-xs text-neutral-500">Dragging {activeDealId}</p> : null}
    </div>
  )
}
