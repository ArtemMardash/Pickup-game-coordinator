import { useState } from 'react'
import { SEED_GAMES } from '../data/seed'
import type { Game } from '../types'

/**
 * Single source of truth for game data. When the database lands, only this
 * file should change — components depend on the shape it returns.
 */
export function useGames() {
  const [games] = useState<Game[]>(() => SEED_GAMES)

  return { games }
}
