import { Card, CardDescription, CardHeader, CardTitle } from '../layout/ui/card.js'

export type ActivityItem = {
  id: string
  title: string
  detail: string
  at: string
}

/**
 * Compact event list for recent account/deal/contact activity.
 */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest changes across relationships and deals.</CardDescription>
      </CardHeader>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="border-l border-neutral-200 pl-4">
            <p className="text-sm font-medium text-neutral-900">{item.title}</p>
            <p className="text-sm text-neutral-600">{item.detail}</p>
            <p className="mt-1 text-xs text-neutral-500">{item.at}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
