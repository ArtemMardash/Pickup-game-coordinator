import type { GameSummary } from './endpoints'
import { CURRENT_USER } from '../types'
import type { Game } from '../types'

/**
 * Temporary bridge: seed Games as API-shaped summaries.
 * Delete when `useGames` fetches from `endpoints.games.list()`.
 */
export function toSummary(game: Game): GameSummary {
  return {
    game_id: Number.parseInt(game.id.replace(/\D/g, ''), 10) || 0,
    title: game.title,
    game_name: game.sport.label,
    organizer_id: game.hostId,
    organizer_username: game.hostId === CURRENT_USER.id ? CURRENT_USER.name : 'Organizer',
    start_time: new Date(game.startAt).toISOString(),
    end_time: new Date(game.endAt).toISOString(),
    location: game.location,
    latitude: null,
    longitude: null,
    is_online: false,
    skill_level:
      game.skillLevel === 'Beginner' ? 'beginner' : 'advanced',
    language: game.language,
    capacity: game.capacity,
    players_joined: game.players.length,
    spots_left: Math.max(game.capacity - game.players.length, 0),
    status: 'upcoming',
    tags: [],
    distance_km: null,
  }
}
