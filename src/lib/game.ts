import { CURRENT_USER } from '../types'
import type { Game } from '../types'

export function spotsLeft(game: Game): number {
  return Math.max(game.capacity - game.players.length, 0)
}

export function isFull(game: Game): boolean {
  return game.players.length >= game.capacity
}

export function hasJoined(game: Game, userId: string = CURRENT_USER.id): boolean {
  return game.players.some((player) => player.id === userId)
}

export function isMine(game: Game, userId: string = CURRENT_USER.id): boolean {
  return game.hostId === userId
}
