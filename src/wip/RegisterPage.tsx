import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { Button } from '../components/ui/button.tsx'
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'

/**
 * Account creation page.
 */
export function RegisterPage() {
  const { register, mode } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLocalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await register({ name, email, password })
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create account right now')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleKindeRegister() {
    setIsSubmitting(true)
    setError(null)

    try {
      await register()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create account right now')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5] px-4">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="px-0 pt-0">
          <p className="text-xs font-medium text-neutral-500">SoapCRM</p>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            {mode === 'kinde' ? 'Create your account with Kinde.' : 'Create your account.'}
          </CardDescription>
        </CardHeader>

        {mode === 'kinde' ? (
          <div className="space-y-4">
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}
            <Button type="button" className="w-full" onClick={handleKindeRegister} disabled={isSubmitting}>
              {isSubmitting ? 'Redirecting…' : 'Create account with Kinde'}
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleLocalSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-800" htmlFor="register-name">
                Full name
              </label>
              <Input
                id="register-name"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-800" htmlFor="register-email">
                Email
              </label>
              <Input
                id="register-email"
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-800" htmlFor="register-password">
                Password
              </label>
              <Input
                id="register-password"
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-neutral-600">
          Already have an account?{' '}
          <Link className="font-medium text-emerald-700 hover:text-emerald-600" to="/login">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  )
}
