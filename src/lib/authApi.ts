import { ApiError, api } from './api'
import { authHeader, endpoints } from './endpoints'
import type { LoginRequest, RegisterRequest, TokenResponse, UserProfile } from './endpoints'

export interface AuthResult {
  token: string
  expiresIn: number
  user: UserProfile
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const body: LoginRequest = { email, password }
  const tokens = await api<TokenResponse>(endpoints.auth.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const user = await api<UserProfile>(endpoints.users.me, {
    headers: authHeader(tokens.access_token),
  })

  return { token: tokens.access_token, expiresIn: tokens.expires_in, user }
}

/**
 * Registering does not sign the user in server-side, so this logs in straight
 * afterwards. A failed login after a successful register would leave an
 * account with no session; surface that rather than hiding it.
 */
export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const body: RegisterRequest = { username, email, password }
  await api<UserProfile>(endpoints.auth.register, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  try {
    return await login(email, password)
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw new ApiError(
        cause.status,
        'Account created, but signing in failed. Try signing in.',
        cause.reason,
      )
    }
    throw cause
  }
}
