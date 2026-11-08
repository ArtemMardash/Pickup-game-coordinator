import { useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { FilterBar } from './components/FilterBar'
import { GameCard } from './components/GameCard'
import { GameDetail } from './components/GameDetail'
import type { JoinState } from './components/GameDetail'
import { MapPanel } from './components/MapPanel'
import { TopNav } from './components/TopNav'
import { toSummary } from './lib/adapter'
import { useAuth } from './state/authContext'
import { SPORTS } from './types'
import type { Tab } from './types'
import { useGames } from './state/useGames'
import styles from './App.module.css'

const SPORTS_BY_LABEL = new Map(SPORTS.map((s) => [s.label.toLowerCase(), s]))

function Dashboard() {
  const { user } = useAuth()
  const { games, join, leave } = useGames()
  const [activeTab, setActiveTab] = useState<Tab>('explore')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = games.find((game) => game.id === selectedId) ?? null
  const meId = user?.id ?? ''

  function joinStateOf(game: (typeof games)[number]): JoinState {
    const joined = game.players.some((p) => p.id === meId)
    if (game.hostId === meId) return 'organizer'
    if (joined) return 'joined'
    if (game.players.length >= game.capacity) return 'full'
    return 'can-join'
  }

  const summary = selected ? toSummary(selected) : null
  const sportEmoji = summary
    ? SPORTS_BY_LABEL.get(summary.game_name.toLowerCase())?.emoji
    : undefined

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
              <h2 className={styles.heading}>
                {selected ? 'Game details' : 'Games near you'}
              </h2>
              <span className={styles.count}>{games.length} games</span>
            </div>

            <div className={styles.feedPanel}>
              {selected && summary ? (
                <GameDetail
                  game={summary}
                  sportEmoji={sportEmoji}
                  joinedCount={selected.players.length}
                  joinState={joinStateOf(selected)}
                  description={selected.description}
                  onBack={() => setSelectedId(null)}
                  onJoin={() => join(selected.id)}
                  onLeave={() => leave(selected.id)}
                  onDelete={() => setSelectedId(null)}
                />
              ) : (
                games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onOpen={() => setSelectedId(game.id)}
                  />
                ))
              )}
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

function App() {
  const { status } = useAuth()

  if (status !== 'authenticated') return <AuthGate />

  return <Dashboard />
}

export default App
