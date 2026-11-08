import { createContext, useContext } from 'react'
import type { UserProfile } from '../lib/endpoints'

/** Session state shared by the whole app. */
export interface AuthState {
  user: UserProfile | null
  token: string | null
  status: 'authenticated' | 'anonymous'
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
