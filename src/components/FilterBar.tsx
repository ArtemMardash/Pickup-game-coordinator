import type { ApiSkillLevel, GameSort } from '../lib/endpoints'
import { activeFilterCount, EMPTY_FILTERS } from '../lib/filters'
import type { Filters } from '../lib/filters'
import { sportEmoji } from '../lib/sport' // MAP FEATURE
import { LANGUAGES, SPORTS } from '../types'
import { LocationFilter } from './LocationFilter' // MAP FEATURE
import { FilterMenu } from './ui/FilterMenu'
import styles from './FilterBar.module.css'

const SPORT_OPTIONS = SPORTS.map((sport) => ({
  value: sport.label,
  label: sport.label,
  emoji: sport.emoji,
}))

const SKILL_OPTIONS: { value: ApiSkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const LANGUAGE_OPTIONS = LANGUAGES.map((language) => ({
  value: language,
  label: language,
}))

const SORT_OPTIONS: { value: GameSort; label: string }[] = [
  { value: 'start_time', label: 'Soonest first' },
  { value: 'game_name', label: 'Sport A–Z' },
  { value: 'skill_level', label: 'Skill level' },
]

interface FilterBarProps {
  filters: Filters
  onChange: (filters: Filters) => void
  /**
   * MAP FEATURE (S10.1 / S10.4): sports and languages that appear in current
   * upcoming listings. When omitted (not loaded yet) the full catalogue is
   * used, which is how the bar behaved before.
   */
  availableSports?: string[]
  availableLanguages?: string[]
}

/** MAP FEATURE: alphabetical option list that never drops a selected value. */
function optionsFrom(available: string[], selected: string[]) {
  return [...new Set([...available, ...selected])]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }))
}

export function FilterBar({
  filters,
  onChange,
  availableSports,
  availableLanguages,
}: FilterBarProps) {
  const total = activeFilterCount(filters)
  // MAP FEATURE: use live options when we have them, else the static lists.
  const sportOptions = availableSports
    ? optionsFrom(availableSports, filters.sports).map((o) => ({
        ...o,
        emoji: sportEmoji(o.value),
      }))
    : SPORT_OPTIONS
  const languageOptions = availableLanguages
    ? optionsFrom(availableLanguages, filters.languages)
    : LANGUAGE_OPTIONS

  return (
    <div className={styles.bar}>
      <nav className={styles.filters} aria-label="Filters">
        <FilterMenu
          label="Game"
          options={sportOptions}
          selected={filters.sports}
          onChange={(sports) => onChange({ ...filters, sports })}
        />
        <FilterMenu
          label="Skill Level"
          options={SKILL_OPTIONS}
          selected={filters.skillLevels}
          onChange={(skillLevels) =>
            onChange({ ...filters, skillLevels: skillLevels as ApiSkillLevel[] })
          }
        />
        <FilterMenu
          label="Language"
          options={languageOptions}
          selected={filters.languages}
          onChange={(languages) => onChange({ ...filters, languages })}
        />
        {/* MAP FEATURE (S10.3): filter by area + distance. */}
        <LocationFilter
          value={filters.location}
          onChange={(location) => onChange({ ...filters, location })}
        />
        <FilterMenu
          label="Sort"
          options={SORT_OPTIONS}
          selected={filters.sort ? [filters.sort] : []}
          multiple={false}
          onChange={(next) => onChange({ ...filters, sort: (next[0] as GameSort) ?? null })}
        />

        {total > 0 && (
          <button
            type="button"
            className={styles.clearAll}
            // MAP FEATURE: keep the chosen sort. Sorting is not a filter, and
            // the sort should survive filter changes (S11.1).
            onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}
          >
            Clear all
          </button>
        )}
      </nav>
    </div>
  )
}
