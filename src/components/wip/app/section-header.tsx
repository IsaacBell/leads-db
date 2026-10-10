import type { ReactNode } from 'react'

/**
 * Shared heading block for page sections.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        {eyebrow ? <p className="text-xs font-medium text-neutral-500">{eyebrow}</p> : null}
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{title}</h2>
        {description ? <p className="max-w-2xl text-sm text-neutral-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
