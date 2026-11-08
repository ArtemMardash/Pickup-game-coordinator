import { initialsOf } from '../lib/avatar'
import { useAuth } from '../state/authContext'
import type { Tab } from '../types'
import { Button } from './ui/Button'
import styles from './TopNav.module.css'

interface TopNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onCreatePost: () => void
}

export function TopNav({ activeTab, onTabChange, onCreatePost }: TopNavProps) {
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

      <div className={styles.search}>
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
