import type { ApiSkillLevel, GameSort } from '../lib/endpoints'
import { activeFilterCount, EMPTY_FILTERS } from '../lib/filters'
import type { Filters } from '../lib/filters'
import { LANGUAGES, SPORTS } from '../types'
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
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const total = activeFilterCount(filters)

  return (
    <div className={styles.bar}>
      <nav className={styles.filters} aria-label="Filters">
        <FilterMenu
          label="Game"
          options={SPORT_OPTIONS}
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
          options={LANGUAGE_OPTIONS}
          selected={filters.languages}
          onChange={(languages) => onChange({ ...filters, languages })}
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
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Clear all
          </button>
        )}
      </nav>
    </div>
  )
}
