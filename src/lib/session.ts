import type { UserProfile } from './endpoints'

const STORAGE_KEY = 'pickup.auth'

export interface StoredSession {
  token: string
  /** Epoch milliseconds. */
  expiresAt: number
  user: UserProfile
}

export function readSession(): StoredSession | null {
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

export function writeSession(session: StoredSession | null) {
  if (session === null) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

type UnauthorizedHandler = () => void

let handler: UnauthorizedHandler | null = null

/**
 * Registers the callback that signs the user out on a rejected token. Owned by
 * the auth provider so `api.ts` need not import React state.
 */
export function setUnauthorizedHandler(next: UnauthorizedHandler | null) {
  handler = next
}

export function notifyUnauthorized() {
  handler?.()
}
