import { useCallback, useMemo } from 'react'
import { signIn, signOut, useSession } from './client'
import type { User } from '../../types/auth'
import {
  AuthContext,
  type AuthContextValue,
  type LoginPayload,
  type RegisterPayload,
} from './AuthContext'

type SessionUser = NonNullable<ReturnType<typeof useSession>['data']>['user']

function mapUser(user: SessionUser | null): User | null {
  if (!user) {
    return null
  }

  const { id, email, name, createdAt } = user
  const candidate = user as { role?: unknown }
  const role = typeof candidate.role === 'string' ? candidate.role : 'user'

  return {
    id,
    email,
    name,
    role,
    created_at: createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString(),
  }
}

/**
 * Provides auth state from a Better Auth session cookie.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession()
  const user = mapUser(data?.user ?? null)
  const isLoading = isPending

  const login = useCallback(async (payload?: LoginPayload) => {
    const email = payload?.email
    if (!email) {
      throw new Error('Email is required to request a magic link.')
    }
    await signIn.magicLink({ email })
  }, [])

  const register = useCallback(async (payload?: RegisterPayload) => {
    const email = payload?.email
    if (!email) {
      throw new Error('Email is required to request a magic link.')
    }
    await signIn.magicLink({ email, name: payload?.name })
  }, [])

  const logout = useCallback(() => {
    void signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'better-auth',
      token: null,
      user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
