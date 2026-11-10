/**
 * Pure helpers for the map (MAP FEATURE: new file). No Google Maps calls here,
 * so everything in this file is easy to unit test.
 */
import type { GameSummary } from './endpoints'

export interface PinGroup {
  /** Stable id for a spot on the map. */
  key: string
  lat: number
  lng: number
  /** Every game at this spot, in the order the server sorted them. */
  games: GameSummary[]
}

/** ~11 m precision: games at the same venue share one pin (S8.1). */
export function locationKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/**
 * Games that get a pin (S7.1): upcoming/active, offline, with coordinates.
 * Online games, games past their end time, and games the geocoder couldn't
 * place never appear on the map (they still appear in the list).
 */
export function groupPins(games: GameSummary[], now: number = Date.now()): PinGroup[] {
  const groups = new Map<string, PinGroup>()
  for (const game of games) {
    if (game.is_online) continue
    if (game.latitude === null || game.longitude === null) continue
    if (Date.parse(game.end_time) <= now) continue
    const key = locationKey(game.latitude, game.longitude)
    const existing = groups.get(key)
    if (existing) existing.games.push(game)
    else groups.set(key, { key, lat: game.latitude, lng: game.longitude, games: [game] })
  }
  return [...groups.values()]
}

export function isFull(game: GameSummary): boolean {
  return game.spots_left <= 0
}

/** A shared pin only reads "full" when every game there is full. */
export function groupIsFull(group: PinGroup): boolean {
  return group.games.every(isFull)
}

export const KM_PER_MILE = 1.609344

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE
}
