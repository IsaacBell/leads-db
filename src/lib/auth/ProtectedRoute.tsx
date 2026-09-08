import { Navigate, Outlet } from 'react-router-dom'
import { Card } from '@/src/components/wip/layout/ui/card'
import { useAuth } from './useAuth'

/**
 * Gate that ensures authenticated access to the operator shell routes.
 */
export function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5] px-4">
        <Card className="px-6 py-4 text-sm text-neutral-700">Loading account...</Card>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
