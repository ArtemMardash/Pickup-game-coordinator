import type { ApiSkillLevel, GameFilters, GameSort } from './endpoints'
// MAP FEATURE: miles -> km for the API's radius_km.
import { milesToKm } from './mapGames'

/** MAP FEATURE (S10.3): "games within N miles of a place". */
export interface LocationFilter {
  /** What the user picked, shown on the filter button. */
  label: string
  lat: number
  lng: number
  miles: number
}

/** MAP FEATURE (S10.3): the distances the Location filter offers. */
export const DISTANCE_OPTIONS = [5, 10, 25]

export interface Filters {
  /** Sport names, matching the API's `game_name`. */
  sports: string[]
  skillLevels: ApiSkillLevel[]
  languages: string[]
  sort: GameSort | null
  /** MAP FEATURE (S10.3). Null = off. */
  location: LocationFilter | null
}

export const EMPTY_FILTERS: Filters = {
  sports: [],
  skillLevels: [],
  languages: [],
  sort: null,
  location: null, // MAP FEATURE
}

/**
 * Number of active FILTERS. MAP FEATURE: sort no longer counts. Sorting only
 * reorders results (S11.1), so it must not show "Clear all" or the "No games
 * match your filters" message on its own.
 */
export function activeFilterCount(filters: Filters): number {
  return (
    filters.sports.length +
    filters.skillLevels.length +
    filters.languages.length +
    (filters.location ? 1 : 0)
  )
}

/** Map the UI's filter shape onto the API query parameters. */
export function toQuery(filters: Filters): GameFilters {
  return {
    game_name: filters.sports.length > 0 ? filters.sports : undefined,
    skill_level: filters.skillLevels.length > 0 ? filters.skillLevels : undefined,
    language: filters.languages.length > 0 ? filters.languages : undefined,
    sort: filters.sort ?? undefined,
    // MAP FEATURE (S10.3): the server returns only offline games in range.
    lat: filters.location?.lat,
    lng: filters.location?.lng,
    radius_km: filters.location ? milesToKm(filters.location.miles) : undefined,
    // MAP FEATURE: the API default is 50, which would silently drop pins.
    // 200 is the API maximum; see the notes for what to do beyond that.
    limit: 200,
  }
}
