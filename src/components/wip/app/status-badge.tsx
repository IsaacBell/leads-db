import { Badge } from '../layout/ui/badge.js'

/**
 * Consistent semantic badge mapping for status/stage labels.
 */
export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase()

  if (normalized === 'won' || normalized === 'customer') {
    return <Badge variant="default">{value}</Badge>
  }
  if (normalized === 'lost' || normalized === 'inactive' || normalized === 'overdue') {
    return <Badge variant="destructive">{value}</Badge>
  }
  if (normalized === 'proposal' || normalized === 'qualification' || normalized === 'qualified') {
    return <Badge variant="warning">{value}</Badge>
  }

  return <Badge variant="neutral">{value}</Badge>
}
