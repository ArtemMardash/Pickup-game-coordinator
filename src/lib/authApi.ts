import type { TokenResponse, UserProfile } from './endpoints'

/**
 * STUB — accepts any credentials and touches no network.
 *
 * To go live, replace the two functions below with `api()` calls to
 * `endpoints.auth.login` and `endpoints.auth.register`; the signatures already
 * match. Registration does not sign you in server-side, so chain a login.
 */

export interface AuthResult {
  token: string
  /** From the backend's `expires_in`. */
  expiresIn: number
  user: UserProfile
}

const STUB_EXPIRES_IN = 30 * 60
const STUB_TOKEN = 'stub-token-not-valid-server-side'

function fakeUser(username: string, email: string): UserProfile {
  return {
    id: 'stub-user',
    username,
    email,
    notify_non_critical: true,
    created_at: new Date().toISOString(),
  }
}

function usernameFromEmail(email: string): string {
  return email.split('@')[0] ?? 'player'
}

const STUB_PASSWORDS: Record<string, string> = {}

export async function login(email: string, password: string): Promise<AuthResult> {
  const known = STUB_PASSWORDS[email.toLowerCase()]
  if (known !== undefined && known !== password) {
    throw new Error('Incorrect email or password')
  }
  return {
    token: STUB_TOKEN,
    expiresIn: STUB_EXPIRES_IN,
    user: fakeUser(usernameFromEmail(email), email),
  }
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  STUB_PASSWORDS[email.toLowerCase()] = password
  return { token: STUB_TOKEN, expiresIn: STUB_EXPIRES_IN, user: fakeUser(username, email) }
}

export type { TokenResponse }
