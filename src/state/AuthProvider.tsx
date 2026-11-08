import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../lib/authApi'
import {
  readSession,
  setUnauthorizedHandler,
  writeSession,
} from '../lib/session'
import type { StoredSession } from '../lib/session'
import { AuthContext } from './authContext'
import type { AuthState } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(readSession)

  const logout = useCallback(() => {
    writeSession(null)
    setSession(null)
  }, [])

  // A rejected token ends the session, so the gate takes over.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

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
