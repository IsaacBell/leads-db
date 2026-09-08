import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { apiRequest } from '../api'
import {
  captureAnalyticsEvent,
  identifyAnalyticsUser,
  resetAnalyticsIdentity,
} from '../analytics'
import type { AuthResponse, User } from '../../types/auth'
import {
  AuthContext,
  type AuthContextValue,
  type LoginPayload,
  type RegisterPayload,
} from './AuthContext'

const TOKEN_STORAGE_KEY = 'core.auth_token'
const KINDE_CLIENT_ID = import.meta.env.VITE_KINDE_CLIENT_ID?.trim()
const KINDE_DOMAIN = import.meta.env.VITE_KINDE_DOMAIN?.trim()
const KINDE_ENABLED = Boolean(KINDE_CLIENT_ID && KINDE_DOMAIN)
const KINDE_TOKEN_REFRESH_MS = 45_000

function normalizeAuthToken(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const token = value.trim()
  if (!token) {
    return null
  }

  return token.startsWith('Bearer ') ? token.slice('Bearer '.length).trim() : token
}

function isJwtLike(value: string) {
  return value.split('.').length === 3
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep local auth as a fallback so existing dev/test flows work without Kinde keys.
  if (KINDE_ENABLED) {
    return <KindeBackedAuthProvider>{children}</KindeBackedAuthProvider>
  }

  return <LocalAuthProvider>{children}</LocalAuthProvider>
}

function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  })

  const meQuery = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: async () => {
      if (!token) {
        return null
      }

      try {
        return await apiRequest<User>('/api/auth/me', { token })
      } catch (error) {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        queryClient.removeQueries({ queryKey: ['auth', 'me'] })
        throw error
      }
    },
    enabled: Boolean(token),
    retry: false,
  })

  const updateSession = useCallback(
    (authResponse: AuthResponse) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, authResponse.token)
      setToken(authResponse.token)
      queryClient.setQueryData(['auth', 'me', authResponse.token], authResponse.user)
      identifyAnalyticsUser(authResponse.user)
    },
    [queryClient],
  )

  const logout = useCallback(() => {
    captureAnalyticsEvent('auth_logout', { auth_mode: 'local' })
    resetAnalyticsIdentity()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    queryClient.removeQueries({ queryKey: ['auth', 'me'] })
  }, [queryClient])

  const login = useCallback(
    async (payload?: LoginPayload) => {
      // Local mode still expects explicit credentials from the login form.
      if (!payload) {
        throw new Error('Email and password are required for local login.')
      }

      const authResponse = await apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      updateSession(authResponse)
      captureAnalyticsEvent('auth_login_succeeded', { auth_mode: 'local' })
    },
    [updateSession],
  )

  const register = useCallback(
    async (payload?: RegisterPayload) => {
      if (!payload) {
        throw new Error('Name, email, and password are required for local registration.')
      }

      const authResponse = await apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      updateSession(authResponse)
      captureAnalyticsEvent('auth_register_succeeded', { auth_mode: 'local' })
    },
    [updateSession],
  )

  const user = token ? (meQuery.data ?? null) : null
  const isLoading = token ? meQuery.isPending : false

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'local',
      token,
      user,
      isLoading,
      login,
      register,
      logout,
    }),
    [token, user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function KindeBackedAuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const {
    isAuthenticated,
    isLoading: isKindeLoading,
    getAccessToken,
    getToken,
    getIdToken,
    login: kindeLogin,
    register: kindeRegister,
    logout: kindeLogout,
  } = useKindeAuth()
  const [token, setToken] = useState<string | null>(null)
  const [isTokenLoading, setIsTokenLoading] = useState(false)
  const hasTrackedKindeLoginRef = useRef(false)

  const resolveApiToken = useCallback(async () => {
    // Providers differ on which getter returns an API-usable JWT.
    const accessToken = await getAccessToken()
    const genericToken = await getToken()
    const idToken = await getIdToken()
    const tokenCandidates = [accessToken, genericToken, idToken]
      .map(normalizeAuthToken)
      .filter((candidate): candidate is string => Boolean(candidate))
    return tokenCandidates.find((candidate) => isJwtLike(candidate)) ?? tokenCandidates[0] ?? null
  }, [getAccessToken, getIdToken, getToken])

  useEffect(() => {
    let isCancelled = false

    async function syncAccessToken(silent = false) {
      // Kinde owns session state, so we derive API token from Kinde after auth settles.
      if (!isAuthenticated) {
        setToken(null)
        setIsTokenLoading(false)
        queryClient.removeQueries({ queryKey: ['auth', 'me'] })
        return
      }

      if (!silent) {
        setIsTokenLoading(true)
      }

      try {
        const latestToken = await resolveApiToken()
        if (!isCancelled) {
          setToken(latestToken)
        }
      } catch {
        // On background refresh failures, keep current token and try again on next refresh/focus.
        if (!isCancelled && !silent) {
          setToken(null)
          queryClient.removeQueries({ queryKey: ['auth', 'me'] })
        }
      } finally {
        if (!isCancelled && !silent) {
          setIsTokenLoading(false)
        }
      }
    }

    if (isAuthenticated) {
      void syncAccessToken()
    }

    return () => {
      isCancelled = true
    }
  }, [isAuthenticated, queryClient, resolveApiToken])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    // Keep API calls healthy for long-lived sessions without forcing a full auth reload.
    let isCancelled = false

    async function refreshToken() {
      try {
        const latestToken = await resolveApiToken()
        // Background refresh should not clear an otherwise valid active session.
        if (!isCancelled && latestToken) {
          setToken(latestToken)
        }
      } catch {
        // Ignore background refresh failures; focused/user-initiated calls will re-check auth.
      }
    }

    const refreshTimer = window.setInterval(() => {
      void refreshToken()
    }, KINDE_TOKEN_REFRESH_MS)

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshToken()
      }
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      isCancelled = true
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
    }
  }, [isAuthenticated, resolveApiToken])

  const meQuery = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: async () => {
      if (!token) {
        return null
      }

      return await apiRequest<User>('/api/auth/me', { token })
    },
    enabled: Boolean(token),
    retry: false,
  })

  const logout = useCallback(() => {
    captureAnalyticsEvent('auth_logout', { auth_mode: 'kinde' })
    resetAnalyticsIdentity()
    hasTrackedKindeLoginRef.current = false
    setToken(null)
    queryClient.removeQueries({ queryKey: ['auth', 'me'] })
    void kindeLogout()
  }, [kindeLogout, queryClient])

  const login = useCallback(async () => {
    await kindeLogin()
  }, [kindeLogin])

  const register = useCallback(async () => {
    await kindeRegister()
  }, [kindeRegister])

  const user = token ? (meQuery.data ?? null) : null
  const isLoading = isKindeLoading || isTokenLoading || (token ? meQuery.isPending : false)

  useEffect(() => {
    if (!user) {
      hasTrackedKindeLoginRef.current = false
      return
    }

    identifyAnalyticsUser(user)

    // Kinde login resolves via redirect; track once when session user data is available.
    if (!hasTrackedKindeLoginRef.current) {
      captureAnalyticsEvent('auth_login_succeeded', { auth_mode: 'kinde' })
      hasTrackedKindeLoginRef.current = true
    }
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'kinde',
      token,
      user,
      isLoading,
      login,
      register,
      logout,
    }),
    [token, user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
