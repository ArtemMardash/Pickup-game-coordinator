import type { ApiSkillLevel, GameFilters, GameSort } from './endpoints'

export interface Filters {
  /** Sport names, matching the API's `game_name`. */
  sports: string[]
  skillLevels: ApiSkillLevel[]
  languages: string[]
  sort: GameSort | null
}

export const EMPTY_FILTERS: Filters = {
  sports: [],
  skillLevels: [],
  languages: [],
  sort: null,
}

export function activeFilterCount(filters: Filters): number {
  return (
    filters.sports.length +
    filters.skillLevels.length +
    filters.languages.length +
    (filters.sort ? 1 : 0)
  )
}

/** Map the UI's filter shape onto the API query parameters. */
export function toQuery(filters: Filters): GameFilters {
  return {
    game_name: filters.sports.length > 0 ? filters.sports : undefined,
    skill_level: filters.skillLevels.length > 0 ? filters.skillLevels : undefined,
    language: filters.languages.length > 0 ? filters.languages : undefined,
    sort: filters.sort ?? undefined,
  }
}
