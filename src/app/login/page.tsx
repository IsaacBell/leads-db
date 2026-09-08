'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from "@/src/lib/auth/useAuth"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import { Input } from "@/src/components/wip/layout/ui/input"

/**
 * Sign-in via magic link. Emails a one-time sign-in link; the user is created
 * on first sign-in (no separate registration step).
 */
export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await login({ email })
      setSent(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in right now')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5] px-4">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="px-0 pt-0">
          <p className="text-xs font-medium text-neutral-500">LeadsDB</p>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Enter your email to receive a sign-in link.</CardDescription>
        </CardHeader>

        {sent ? (
          <div className="space-y-2 text-sm text-neutral-700">
            <p>Check your inbox. We emailed a sign-in link to <strong>{email}</strong>.</p>
            <button type="button" className="font-medium text-emerald-700 hover:text-emerald-600" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-800" htmlFor="login-email">
                Email
              </label>
              <Input
                id="login-email"
                required
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting || !email}>
              {isSubmitting ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-neutral-600">
          New here?{' '}
          <Link className="font-medium text-emerald-700 hover:text-emerald-600" href="/register">
            Create an account
          </Link>
        </p>
      </Card>
    </main>
  )
}
