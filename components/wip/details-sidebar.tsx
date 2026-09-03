import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx'

/**
 * Right-rail info block for entity pages.
 */
export function DetailSidebar({
  quickFacts,
  related,
  nextActions,
}: {
  quickFacts: Array<{ label: string; value: string }>
  related: string[]
  nextActions: string[]
}) {
  return (
    <aside className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quick facts</CardTitle>
        </CardHeader>
        <dl className="space-y-3 text-sm">
          {quickFacts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-neutral-500">{fact.label}</dt>
              <dd className="font-medium text-neutral-900">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related records</CardTitle>
          <CardDescription>Other items connected to this record.</CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm text-neutral-700">
          {related.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next actions</CardTitle>
          <CardDescription>Suggested next steps.</CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm text-neutral-700">
          {nextActions.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </Card>
    </aside>
  )
}
