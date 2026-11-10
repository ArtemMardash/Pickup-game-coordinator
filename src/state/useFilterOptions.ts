import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { authHeader, endpoints } from '../lib/endpoints'
import type { GameList } from '../lib/endpoints'
import { useAuth } from './authContext'

/**
 * MAP FEATURE (new file, S10.1 / S10.4): the Game and Language filters list
 * only what appears in current upcoming listings, sorted alphabetically.
 *
 * The visible list is already filtered, so options come from a separate,
 * unfiltered request. Otherwise picking "Soccer" would remove every other
 * sport from the menu. Refetched when `version` changes (a post was created,
 * edited, or the list reloaded).
 */
export interface FilterOptions {
  sports: string[]
  languages: string[]
}

export function useFilterOptions(version: number): FilterOptions | null {
  const { token } = useAuth()
  const [options, setOptions] = useState<FilterOptions | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true
    api<GameList>(endpoints.games.list({ limit: 200 }), { headers: authHeader(token) })
      .then((list) => {
        if (!active) return
        const unique = (values: string[]) =>
          [...new Set(values)].sort((a, b) => a.localeCompare(b))
        setOptions({
          sports: unique(list.items.map((g) => g.game_name)),
          languages: unique(list.items.map((g) => g.language)),
        })
      })
      .catch(() => {
        // Keep the previous options (or the static fallback) on failure.
      })
    return () => {
      active = false
    }
  }, [token, version])

  return options
}
