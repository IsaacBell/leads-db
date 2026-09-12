'use client'

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from "@/src/lib/auth/useAuth"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import { Input } from "@/src/components/wip/layout/ui/input"

/**
 * Account creation. Better Auth creates the user on first magic-link sign-in,
 * so this just collects a name and kicks off the same email flow.
 */
export default function RegisterPage() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await register({ name, email })
      setSent(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create account right now')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5] px-4">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="px-0 pt-0">
          <p className="text-xs font-medium text-neutral-500">LeadsDB</p>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>Enter your name and email to get started.</CardDescription>
        </CardHeader>

        {sent ? (
          <div className="space-y-2 text-sm text-neutral-700">
            <p>Almost done. We emailed a sign-in link to <strong>{email}</strong> — open it to activate your account.</p>
            <button type="button" className="font-medium text-emerald-700 hover:text-emerald-600" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
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

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting || !name || !email}>
              {isSubmitting ? 'Sending…' : 'Create account'}
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
