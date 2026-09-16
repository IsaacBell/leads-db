import type { ReactNode } from 'react'

/**
 * Shared header for entity-focused pages (contacts/companies/deals).
 */
export function EntityHeader({
  title,
  subtitle,
  metadata,
  actions,
}: {
  title: string
  subtitle: string
  metadata: Array<{ label: string; value: string }>
  actions?: ReactNode
}) {
  return (
    <header className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{title}</h1>
          <p className="text-sm text-neutral-600">{subtitle}</p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        {metadata.map((item) => (
          <div key={item.label}>
            <dt className="text-neutral-500">{item.label}</dt>
            <dd className="font-medium text-neutral-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  )
}
