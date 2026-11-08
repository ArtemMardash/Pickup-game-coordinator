import { useCallback, useState } from 'react'
import { SEED_GAMES } from '../data/seed'
import { CURRENT_USER } from '../types'
import type { Game } from '../types'

/**
 * In-memory seed data. When the API layer lands, only this file changes.
 */
export function useGames() {
  const [games, setGames] = useState<Game[]>(() => SEED_GAMES)

  const join = useCallback((gameId: string) => {
    setGames((current) =>
      current.map((game) => {
        if (game.id !== gameId) return game
        if (game.players.some((player) => player.id === CURRENT_USER.id)) return game
        if (game.players.length >= game.capacity) return game
        return { ...game, players: [...game.players, CURRENT_USER] }
      }),
    )
  }, [])

  const leave = useCallback((gameId: string) => {
    setGames((current) =>
      current.map((game) => {
        if (game.id !== gameId) return game
        if (game.hostId === CURRENT_USER.id) return game
        return {
          ...game,
          players: game.players.filter((player) => player.id !== CURRENT_USER.id),
        }
      }),
    )
  }, [])

  return { games, join, leave }
}
