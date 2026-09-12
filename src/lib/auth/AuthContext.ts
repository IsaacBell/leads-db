import { createContext } from 'react'
import type { User } from '../../types/auth'

export type LoginPayload = {
  email: string
}

export type RegisterPayload = {
  email: string
  name?: string
}

/**
 * @deprecated Legacy mode flag, retained so in-flight operator-shell pages
 * keep compiling. Identity is now a Better Auth session cookie; see `user`.
 */
export type AuthMode = 'better-auth'

export type AuthContextValue = {
  mode: AuthMode
  /**
   * @deprecated this is always null. Protected data routes must read the session server-side;
   * shell pages still gating on `token` need migrating to that model.
   */
  token: string | null
  user: User | null
  isLoading: boolean
  login: (payload?: LoginPayload) => Promise<void>
  register: (payload?: RegisterPayload) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
