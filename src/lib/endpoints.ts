/**
 * Backend API reference for the frontend: every endpoint path plus the exact
 * request and response shapes. Nothing here calls the network; pair it with
 * `api()` from `./api`, e.g.
 *
 *   const games = await api<GameList>(endpoints.games.list(filters), {
 *     headers: authHeader(token),
 *   })
 *
 * Source of truth is the backend (http://localhost:8000/docs and
 * backend/README.md). If the backend changes, update this file with it.
 *
 * Replacing the current placeholders
 * ----------------------------------
 *   SEED_GAMES / useGames()            -> endpoints.games.list(...)      GET  /api/games
 *   (game card -> details)             -> endpoints.games.detail(id)     GET  /api/games/{id}
 *   CURRENT_USER (types.ts)            -> endpoints.users.me             GET  /api/users/me
 *   TopNav "+ Create Post" (onCreatePost) -> endpoints.games.create      POST /api/games
 *   (edit post form)                   -> endpoints.games.update(id)     PATCH /api/games/{id}
 *   (cancel post)                      -> endpoints.games.remove(id)     DELETE /api/games/{id}
 *   "Join" button                      -> endpoints.games.join(id)       POST /api/games/{id}/join
 *   "Leave" button                     -> endpoints.games.leave(id)      DELETE /api/games/{id}/participants/me
 *   (organizer removes a player)       -> endpoints.games.removePlayer   DELETE /api/games/{id}/participants/{userId}
 *   Game.players                       -> GameDetail.participants / endpoints.games.players(id)
 *   "My Games" tab                     -> endpoints.games.list({ joined: true })
 *   FilterBar / sort                   -> query params of endpoints.games.list (see GameFilters)
 *   (login / sign-up pages)            -> endpoints.auth.login / endpoints.auth.register
 *   (profile page)                     -> endpoints.users.me / endpoints.users.updateMe
 *
 * Differences from the current frontend model (src/types.ts) to resolve:
 *   - Skill levels are 'beginner' | 'intermediate' | 'advanced' (lowercase),
 *     not 'Beginner' | 'Experienced'.
 *   - `capacity` INCLUDES the organizer, who is on the roster automatically
 *     (the frontend model currently says the host does not occupy a slot).
 *   - Field names: id -> game_id, sport -> game_name, startAt -> start_time,
 *     endAt -> end_time, hostId -> organizer_id, skillLevel -> skill_level.
 *   - Game ids are integers; user ids are UUID strings.
 *   - Times are ISO 8601 and MUST include a timezone offset
 *     (e.g. new Date().toISOString() is fine; '2026-11-01T17:00:00' is rejected).
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ApiSkillLevel = 'beginner' | 'intermediate' | 'advanced'

export const API_SKILL_LEVELS: ApiSkillLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
]

export type GameSort = 'start_time' | 'game_name' | 'skill_level'

/** "upcoming" = not started yet, "active" = in progress. Ended games never appear. */
export type GameStatus = 'upcoming' | 'active'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Reasons returned by the games endpoints (plan, Appendix B.3). */
export type GameErrorReason =
  | 'gameNotFound' // 404
  | 'gameTerminated' // 410: the game already ended
  | 'notOrganizer' // 403
  | 'invalidGameDetails' // 422
  | 'invalidFilter' // 422
  | 'gameFull' // 409
  | 'alreadyJoined' // 409
  | 'notJoined' // 409
  | 'organizerCannotLeave' // 409

/** Error body of the games endpoints. */
export interface GameErrorBody {
  detail: { status: 'error'; reason: GameErrorReason; message: string }
}

/** Error body of auth and user endpoints (plain text message). */
export interface MessageErrorBody {
  detail: string
}

/** Error body for request validation failures (422) from any endpoint. */
export interface ValidationErrorBody {
  detail: { loc: (string | number)[]; msg: string; type: string }[]
}

export type ApiErrorBody =
  | GameErrorBody
  | MessageErrorBody
  | ValidationErrorBody

/**
 * Turn any error body into one message for the UI. Also exposes the games
 * `reason` so the UI can react to e.g. 'gameFull' or 'alreadyJoined'.
 *
 *   401 on any protected endpoint -> token missing/expired: send to login.
 *   "Incorrect email or password" (401 login), "Email is already in use" and
 *   "Username is already in use" (409 register) arrive as plain-text detail.
 */
export function describeApiError(body: unknown): {
  message: string
  reason?: GameErrorReason
} {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return { message: detail }
  if (Array.isArray(detail)) {
    const first = detail[0] as { loc?: unknown[]; msg?: string } | undefined
    const field = first?.loc?.[first.loc.length - 1]
    return {
      message: first?.msg ? `${field ? `${field}: ` : ''}${first.msg}` : 'Invalid input',
    }
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { message?: string; reason?: GameErrorReason }
    return { message: d.message ?? 'Request failed', reason: d.reason }
  }
  return { message: 'Request failed' }
}

// ---------------------------------------------------------------------------
// Auth  (no token needed)
// ---------------------------------------------------------------------------

/** POST /api/auth/register  ->  201 UserProfile. 409 if username/email taken. */
export interface RegisterRequest {
  username: string // 3-50 chars
  email: string
  password: string // 8+ chars, at most 72 bytes
}

/** POST /api/auth/login  ->  200 TokenResponse. 401 if credentials are wrong. */
export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  /** Token lifetime in seconds. */
  expires_in: number
}

// ---------------------------------------------------------------------------
// Users  (token required)
// ---------------------------------------------------------------------------

/** GET /api/users/me  and  PATCH /api/users/me  ->  200 */
export interface UserProfile {
  id: string // UUID
  username: string
  email: string
  notify_non_critical: boolean
  created_at: string
}

/** PATCH /api/users/me. Send at least one field. 409 if the email is taken. */
export interface UpdateProfileRequest {
  email?: string
  notify_non_critical?: boolean
}

// ---------------------------------------------------------------------------
// Games  (token required for everything)
// ---------------------------------------------------------------------------

export interface Participant {
  user_id: string
  username: string
}

/** Compact game used by the list and the map (no roster). */
export interface GameSummary {
  game_id: number
  title: string
  game_name: string // the sport, e.g. 'Basketball'
  organizer_id: string
  organizer_username: string
  start_time: string
  end_time: string
  location: string
  /** Null until the post has coordinates; such games get no map pin. */
  latitude: number | null
  longitude: number | null
  is_online: boolean
  skill_level: ApiSkillLevel
  language: string
  capacity: number // includes the organizer
  players_joined: number // includes the organizer
  spots_left: number
  status: GameStatus
  tags: string[]
  /** Only set when the request used lat/lng/radius_km. */
  distance_km: number | null
}

/** GET /api/games/{id} */
export interface GameDetail
  extends Omit<GameSummary, 'distance_km'> {
  description: string | null
  equipment_notes: string | null
  participants: Participant[]
}

/** GET /api/games */
export interface GameList {
  total: number // matches ignoring limit/offset
  limit: number
  offset: number
  items: GameSummary[]
}

/**
 * Query parameters for GET /api/games. Every selected filter must match.
 * Array values become repeated parameters (skill_level=a&skill_level=b = OR
 * within that filter). Omit a key to leave that filter off.
 */
export interface GameFilters {
  game_name?: string[] // sport, case-insensitive exact match
  skill_level?: ApiSkillLevel[]
  language?: string[]
  /** Text search inside the location, e.g. a neighborhood or city. */
  q?: string
  /** Area search: all three together (e.g. from the map centre / searched place). */
  lat?: number
  lng?: number
  radius_km?: number
  /** Map pins use is_online: false. */
  is_online?: boolean
  /** Hide full games. */
  has_spots?: boolean
  /** Only games the current user is on the roster of ("My Games"). */
  joined?: boolean
  /** Default 'start_time'. Ties are broken by start time, so order is stable. */
  sort?: GameSort
  limit?: number // 1-200, default 50
  offset?: number
}

/** POST /api/games  ->  201 CreateGameResponse. The creator becomes the organizer. */
export interface CreateGameRequest {
  title: string
  game_name: string
  start_time: string // ISO 8601 with timezone
  end_time: string // after start_time, at most 6 hours later, in the future
  location: string
  skill_level: ApiSkillLevel
  capacity: number // 1+, includes the organizer
  language?: string // default 'English'
  is_online?: boolean // default false
  /** From Google Places / Geocoding. Send both or neither. */
  latitude?: number
  longitude?: number
  description?: string
  equipment_notes?: string
  tags?: string[]
}

export interface CreateGameResponse {
  status: 'success'
  message: string
  game_id: number
}

/**
 * PATCH /api/games/{id}  ->  200 GameDetail. Organizer only (403 notOrganizer).
 * Send only the fields that change. Capacity cannot drop below the players
 * already joined. Changing `location` without new coordinates clears the old
 * latitude/longitude, so send the new ones together with a new location.
 */
export type UpdateGameRequest = Partial<CreateGameRequest>

/** DELETE /api/games/{id}  ->  200. Organizer only. Removes the game and its roster. */
export interface DeleteGameResponse {
  status: 'success'
  message: string
  game_id: number
}

/**
 * POST /api/games/{id}/join, DELETE /api/games/{id}/participants/me and
 * DELETE /api/games/{id}/participants/{userId}  ->  200
 *
 * Join can fail with 409 gameFull / alreadyJoined, 410 gameTerminated.
 * Leave can fail with 409 notJoined / organizerCannotLeave (the organizer
 * ends the game by deleting it instead).
 */
export interface RosterChangeResponse {
  status: 'success'
  message: string
  game_id: number
  players_joined: number
}

/** GET /api/games/{id}/players */
export interface PlayerList {
  game_id: number
  capacity: number
  players_joined: number
  players: Participant[]
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Query string for GET /api/games. Arrays are sent as repeated parameters. */
export function gamesQuery(filters: GameFilters = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else {
      params.set(key, String(value))
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Authorization header for every endpoint except register and login. */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}

// Do not add a trailing slash to any path: the server redirects it and the
// browser drops the Authorization header on the redirect.
export const endpoints = {
  auth: {
    /** POST RegisterRequest -> UserProfile */
    register: '/api/auth/register',
    /** POST LoginRequest -> TokenResponse */
    login: '/api/auth/login',
  },
  users: {
    /** GET -> UserProfile */
    me: '/api/users/me',
    /** PATCH UpdateProfileRequest -> UserProfile */
    updateMe: '/api/users/me',
  },
  games: {
    /** GET -> GameList */
    list: (filters?: GameFilters) => `/api/games${gamesQuery(filters)}`,
    /** POST CreateGameRequest -> CreateGameResponse */
    create: '/api/games',
    /** GET -> GameDetail */
    detail: (gameId: number) => `/api/games/${gameId}`,
    /** PATCH UpdateGameRequest -> GameDetail */
    update: (gameId: number) => `/api/games/${gameId}`,
    /** DELETE -> DeleteGameResponse */
    remove: (gameId: number) => `/api/games/${gameId}`,
    /** POST (no body) -> RosterChangeResponse */
    join: (gameId: number) => `/api/games/${gameId}/join`,
    /** DELETE -> RosterChangeResponse (the current user leaves) */
    leave: (gameId: number) => `/api/games/${gameId}/participants/me`,
    /** DELETE -> RosterChangeResponse (organizer removes another player) */
    removePlayer: (gameId: number, userId: string) =>
      `/api/games/${gameId}/participants/${userId}`,
    /** GET -> PlayerList */
    players: (gameId: number) => `/api/games/${gameId}/players`,
  },
  health: '/api/health',
} as const
