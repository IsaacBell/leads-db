import type { ReactNode } from 'react'
import { Card } from '../layout/ui/card.js'

/**
 * Compact metric card used on dashboard summary rows.
 */
export function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: string
  detail?: string
  icon?: ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-500">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-neutral-950">{value}</p>
          {detail ? <p className="text-sm text-neutral-600">{detail}</p> : null}
        </div>
        {icon ? <div className="text-neutral-400">{icon}</div> : null}
      </div>
    </Card>
  )
}
