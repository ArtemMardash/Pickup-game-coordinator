import { useState } from 'react'
import { FilterBar } from './components/FilterBar'
import { GameCard } from './components/GameCard'
import { MapPanel } from './components/MapPanel'
import { TopNav } from './components/TopNav'
import { useGames } from './state/useGames'
import type { Tab } from './types'
import styles from './App.module.css'

function App() {
  const { games } = useGames()
  const [activeTab, setActiveTab] = useState<Tab>('explore')

  return (
    <div className={styles.app}>
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCreatePost={() => {}}
      />
      <FilterBar />

      <main className={styles.main}>
        <div className={styles.split}>
          <section className={styles.feedColumn} aria-label="Game feed">
            <div className={styles.sectionHeader}>
              <h2 className={styles.heading}>Games near you</h2>
              <span className={styles.count}>{games.length} games</span>
            </div>

            <div className={styles.feedPanel}>
              {games.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>

          <section className={styles.mapPanel} aria-label="Map">
            <MapPanel />
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
