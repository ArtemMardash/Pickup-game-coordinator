import styles from './FilterBar.module.css'

const FILTERS = ['Game', 'Skill Level', 'Language', 'Sort'] as const

function Chevron() {
  return (
    <svg
      className={styles.chevron}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 4.5L6 8L9.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FilterBar() {
  return (
    <div className={styles.bar}>
      <nav className={styles.filters} aria-label="Filters">
        {FILTERS.map((label) => (
          <button
            key={label}
            type="button"
            className={styles.filter}
            aria-haspopup="listbox"
          >
            {label}
            <Chevron />
          </button>
        ))}
      </nav>
    </div>
  )
}
