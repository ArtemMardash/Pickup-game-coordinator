import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { authHeader, endpoints } from '../lib/endpoints'
import type {
  CreateGameRequest,
  CreateGameResponse,
  GameDetail,
  GameFilters,
  GameList,
  GameSummary,
  RosterChangeResponse,
  UpdateGameRequest,
} from '../lib/endpoints'
import { useAuth } from './authContext'

/**
 * Game data straight from the API.
 *
 * `GameSummary` carries no "am I on the roster" flag, so joined membership
 * comes from a second call filtered with `joined: true`. When the backend adds
 * a `joined` boolean, drop `fetchJoinedIds` and read it off each summary.
 */
async function fetchJoinedIds(token: string): Promise<Set<number>> {
  const list = await api<GameList>(endpoints.games.list({ joined: true, limit: 200 }), {
    headers: authHeader(token),
  })
  return new Set(list.items.map((game) => game.game_id))
}

export interface GamesState {
  games: GameSummary[]
  joinedIds: Set<number>
  status: 'loading' | 'ready' | 'error'
  error: string | null
  reload: () => void
   /** MAP FEATURE: bumps whenever the list is refetched after a change, so
   *  the filter menus know to refresh their options. */
  version: number
  detail: (gameId: number) => Promise<GameDetail>
  join: (gameId: number) => Promise<void>
  leave: (gameId: number) => Promise<void>
  remove: (gameId: number) => Promise<void>
  create: (body: CreateGameRequest) => Promise<number>
  update: (gameId: number, body: UpdateGameRequest) => Promise<void>
}

export function useGames(filters: GameFilters = {}): GamesState {
  const { token } = useAuth()
  const [games, setGames] = useState<GameSummary[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<number>>(() => new Set())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Membership doesn't depend on the filters, so it is fetched once per
  // session rather than on every filter change.
  useEffect(() => {
    if (!token) return
    let active = true
    fetchJoinedIds(token)
      .then((ids) => {
        if (active) setJoinedIds(ids)
      })
      .catch(() => {
        // The feed still works without membership; only the checkmark is lost.
      })
    return () => {
      active = false
    }
  }, [token, reloadKey])

  const filterKey = JSON.stringify(filters)

  useEffect(() => {
    if (!token) return
    const abort = new AbortController()

    async function load(currentToken: string, currentFilters: GameFilters) {
      setStatus('loading')
      setError(null)
      try {
        const list = await api<GameList>(endpoints.games.list(currentFilters), {
          headers: authHeader(currentToken),
        })
        if (abort.signal.aborted) return
        setGames(list.items)
        setStatus('ready')
      } catch (cause) {
        if (abort.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Could not load games')
        setStatus('error')
      }
    }

    void load(token, JSON.parse(filterKey) as GameFilters)
    return () => abort.abort()
  }, [token, filterKey, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  /** Apply the server's authoritative count without a refetch. */
  const applyCount = useCallback((gameId: number, playersJoined: number, joined: boolean) => {
    setGames((current) =>
      current.map((game) =>
        game.game_id === gameId
          ? {
              ...game,
              players_joined: playersJoined,
              spots_left: Math.max(game.capacity - playersJoined, 0),
            }
          : game,
      ),
    )
    setJoinedIds((current) => {
      const next = new Set(current)
      if (joined) next.add(gameId)
      else next.delete(gameId)
      return next
    })
  }, [])

  const detail = useCallback(
    (gameId: number) => {
      if (!token) return Promise.reject(new Error('Not signed in'))
      return api<GameDetail>(endpoints.games.detail(gameId), { headers: authHeader(token) })
    },
    [token],
  )

  const join = useCallback(
    async (gameId: number) => {
      if (!token) return
      const res = await api<RosterChangeResponse>(endpoints.games.join(gameId), {
        method: 'POST',
        headers: authHeader(token),
      })
      applyCount(gameId, res.players_joined, true)
    },
    [token, applyCount],
  )

  const leave = useCallback(
    async (gameId: number) => {
      if (!token) return
      const res = await api<RosterChangeResponse>(endpoints.games.leave(gameId), {
        method: 'DELETE',
        headers: authHeader(token),
      })
      applyCount(gameId, res.players_joined, false)
    },
    [token, applyCount],
  )

  const remove = useCallback(
    async (gameId: number) => {
      if (!token) return
      await api<unknown>(endpoints.games.remove(gameId), {
        method: 'DELETE',
        headers: authHeader(token),
      })
      setGames((current) => current.filter((game) => game.game_id !== gameId))
    },
    [token],
  )

  const create = useCallback(
    async (body: CreateGameRequest) => {
      if (!token) throw new Error('Not signed in')
      const res = await api<CreateGameResponse>(endpoints.games.create, {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      // Refetch so the new game arrives with the server's ordering and counts.
      setReloadKey((key) => key + 1)
      return res.game_id
    },
    [token],
  )

  const update = useCallback(
    async (gameId: number, body: UpdateGameRequest) => {
      if (!token) throw new Error('Not signed in')
      await api<GameDetail>(endpoints.games.update(gameId), {
        method: 'PATCH',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setReloadKey((key) => key + 1)
    },
    [token],
  )

  return {
    games,
    joinedIds,
    status,
    error,
    reload,
    version: reloadKey, // MAP FEATURE
    detail,
    join,
    leave,
    remove,
    create,
    update,
  }
}
