import type { ReactNode } from 'react' // MAP FEATURE
import { initialsOf } from '../lib/avatar'
import { useAuth } from '../state/authContext'
import type { Tab } from '../types'
import { Button } from './ui/Button'
import styles from './TopNav.module.css'

interface TopNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onCreatePost: () => void
  /**
   * MAP FEATURE (F9): a working search bar shown in place of the built-in
   * one below, which only rendered an input and did nothing.
   */
  search?: ReactNode
}

export function TopNav({ activeTab, onTabChange, onCreatePost, search }: TopNavProps) {
  const { user, logout } = useAuth()
  return (
    <header className={styles.nav}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          ⚡
        </span>
        <span className={styles.brandName}>Pickup Game</span>
      </div>

      <nav className={styles.tabs} aria-label="Primary">
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'explore' ? styles.tabActive : ''}`}
          aria-current={activeTab === 'explore' ? 'page' : undefined}
          onClick={() => onTabChange('explore')}
        >
          Explore
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'my-games' ? styles.tabActive : ''}`}
          aria-current={activeTab === 'my-games' ? 'page' : undefined}
          onClick={() => onTabChange('my-games')}
        >
          My Games
        </button>
      </nav>

      {search}
      {/* MAP FEATURE: the original (inert) search field is hidden when a real
          search bar is passed in. Left in place so this diff stays small. */}
      <div className={styles.search} style={search ? { display: 'none' } : undefined}>
        <div className={styles.searchField}>
          <svg
            className={styles.searchIcon}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M10.8 10.8L14 14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by city, neighborhood, or address..."
            aria-label="Search games by city, neighborhood, or address"
          />
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={onCreatePost}>+ Create Post</Button>
        <span className={styles.avatar} title={user?.username}>
          {user ? initialsOf(user.username) : '?'}
        </span>
        <button type="button" className={styles.logout} onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  )
}
