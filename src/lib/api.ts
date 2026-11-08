import { describeApiError } from './endpoints'
import type { GameErrorReason } from './endpoints'

const API_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
).replace(/\/$/, '')

/** Error carrying the backend's own message and, for games, its `reason`. */
export class ApiError extends Error {  readonly status: number
  readonly reason?: GameErrorReason

  constructor(status: number, message: string, reason?: GameErrorReason) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.reason = reason
  }
}

/**
 * Fetch JSON from the backend. `path` starts with `/`, e.g. `/api/health`.
 * Throws `ApiError` built from the response body, preserving the games `reason`.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init)

  if (!response.ok) {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // Non-JSON body (proxy error page, offline).
    }
    const { message, reason } = describeApiError(body)
    throw new ApiError(
      response.status,
      message === 'Request failed' ? `${response.status} ${response.statusText}` : message,
      reason,
    )
  }

  return response.json() as Promise<T>
}
