import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from "@/src/lib/auth/useAuth"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import { Input } from "@/src/components/wip/layout/ui/input"

/**
 * Sign-in page.
 */
export function LoginPage() {
  const { login, mode } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLocalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in right now')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleKindeLogin() {
    setIsSubmitting(true)
    setError(null)

    try {
      await login()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in right now')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5] px-4">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="px-0 pt-0">
          <p className="text-xs font-medium text-neutral-500">LeadsDB</p>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            {mode === 'kinde' ? 'Sign in with Kinde to continue.' : 'Sign in to continue.'}
          </CardDescription>
        </CardHeader>

        {mode === 'kinde' ? (
          <div className="space-y-4">
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}
            <Button type="button" className="w-full" onClick={handleKindeLogin} disabled={isSubmitting}>
              {isSubmitting ? 'Redirecting…' : 'Sign in with Kinde'}
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleLocalSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-800" htmlFor="login-email">
                Email
              </label>
              <Input
                id="login-email"
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-800" htmlFor="login-password">
                Password
              </label>
              <Input
                id="login-password"
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-neutral-600">
          New here?{' '}
          <Link className="font-medium text-emerald-700 hover:text-emerald-600" to="/register">
            Create an account
          </Link>
        </p>
      </Card>
    </main>
  )
}
