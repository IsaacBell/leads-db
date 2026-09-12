import type { ReactNode } from 'react'

/**
 * Quiet empty-state component with optional action slot.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
      <h3 className="text-base font-semibold tracking-tight text-neutral-950">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
