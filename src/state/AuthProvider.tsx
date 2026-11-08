import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../lib/authApi'
import type { UserProfile } from '../lib/endpoints'
import { AuthContext } from './authContext'
import type { AuthState } from './authContext'

const STORAGE_KEY = 'pickup.auth'

interface StoredSession {
  token: string
  /** Epoch milliseconds. */
  expiresAt: number
  user: UserProfile
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.token || !parsed.user || typeof parsed.expiresAt !== 'number') return null
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    // Corrupt or unreadable storage — treat as signed out rather than crashing.
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function writeSession(session: StoredSession | null) {
  if (session === null) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(readSession)

  const adopt = useCallback((result: authApi.AuthResult) => {
    const next: StoredSession = {
      token: result.token,
      expiresAt: Date.now() + result.expiresIn * 1000,
      user: result.user,
    }
    writeSession(next)
    setSession(next)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      adopt(await authApi.login(email, password))
    },
    [adopt],
  )

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      adopt(await authApi.register(username, email, password))
    },
    [adopt],
  )

  const logout = useCallback(() => {
    writeSession(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      status: session ? 'authenticated' : 'anonymous',
      login,
      register,
      logout,
    }),
    [session, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
