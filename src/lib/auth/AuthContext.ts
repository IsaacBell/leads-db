import { createContext } from 'react'
import type { User } from '../../types/auth'

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  password: string
  name: string
}

export type AuthMode = 'local' | 'kinde'

export type AuthContextValue = {
  mode: AuthMode
  token: string | null
  user: User | null
  isLoading: boolean
  login: (payload?: LoginPayload) => Promise<void>
  register: (payload?: RegisterPayload) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
