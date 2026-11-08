import { useCallback, useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { FilterBar } from './components/FilterBar'
import { GameCard } from './components/GameCard'
import { GameDetail } from './components/GameDetail'
import type { JoinState } from './components/GameDetail'
import { MapPanel } from './components/MapPanel'
import { TopNav } from './components/TopNav'
import { useAuth } from './state/authContext'
import type { GameDetail as GameDetailData } from './lib/endpoints'
import type { Tab } from './types'
import { useGames } from './state/useGames'
import styles from './App.module.css'

function Dashboard() {
  const { user } = useAuth()
  const { games, joinedIds, status, error, reload, detail, join, leave, remove } = useGames()
  const [activeTab, setActiveTab] = useState<Tab>('explore')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<{
    id: number
    data: GameDetailData | null
    error: string | null
  } | null>(null)
  const [busy, setBusy] = useState(false)

  // Derived, so switching games never needs a synchronous setState in an effect.
  const current = loaded && loaded.id === selectedId ? loaded : null
  const full = current?.data ?? null
  const detailError = current?.error ?? null

  const load = useCallback(
    async (gameId: number) => {
      try {
        const data = await detail(gameId)
        setLoaded({ id: gameId, data, error: null })
      } catch (cause) {
        setLoaded({
          id: gameId,
          data: null,
          error: cause instanceof Error ? cause.message : 'Could not load this game',
        })
      }
    },
    [detail],
  )

  useEffect(() => {
    if (selectedId === null) return
    const abort = new AbortController()
    const id = selectedId

    detail(id)
      .then((data) => {
        if (!abort.signal.aborted) setLoaded({ id, data, error: null })
      })
      .catch((cause: unknown) => {
        if (abort.signal.aborted) return
        setLoaded({
          id,
          data: null,
          error: cause instanceof Error ? cause.message : 'Could not load this game',
        })
      })

    return () => abort.abort()
  }, [selectedId, detail])

  const meId = user?.id ?? ''
  const joinState: JoinState = !full
    ? 'can-join'
    : full.organizer_id === meId
      ? 'organizer'
      : full.participants.some((p) => p.user_id === meId)
        ? 'joined'
        : full.spots_left <= 0
          ? 'full'
          : 'can-join'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
      if (selectedId !== null) await load(selectedId)
    } catch (cause) {
      setLoaded({
        id: selectedId ?? 0,
        data: null,
        error: cause instanceof Error ? cause.message : 'That did not work',
      })
    } finally {
      setBusy(false)
    }
  }

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
                {selectedId !== null ? 'Game details' : 'Games near you'}
              </h2>
              <span className={styles.count}>{games.length} games</span>
            </div>

            <div className={styles.feedPanel}>
              {selectedId !== null ? (
                <>
                  {detailError && (
                    <p className={styles.notice} role="alert">
                      {detailError}
                    </p>
                  )}
                  {full ? (
                    <GameDetail
                      game={full}
                      joinedCount={full.players_joined}
                      joinState={busy ? 'pending' : joinState}
                      description={full.description}
                      onBack={() => setSelectedId(null)}
                      onJoin={() => void run(() => join(full.game_id))}
                      onLeave={() => void run(() => leave(full.game_id))}
                      onDelete={() =>
                        void run(async () => {
                          await remove(full.game_id)
                          setSelectedId(null)
                        })
                      }
                    />
                  ) : (
                    !detailError && <p className={styles.notice}>Loading…</p>
                  )}
                </>
              ) : status === 'loading' ? (
                <p className={styles.notice}>Loading games…</p>
              ) : status === 'error' ? (
                <div className={styles.notice} role="alert">
                  {error}
                  <button type="button" className={styles.retry} onClick={reload}>
                    Try again
                  </button>
                </div>
              ) : games.length === 0 ? (
                <p className={styles.notice}>No games yet. Create the first one.</p>
              ) : (
                games.map((game) => (
                  <GameCard
                    key={game.game_id}
                    game={game}
                    joined={joinedIds.has(game.game_id)}
                    onOpen={() => setSelectedId(game.game_id)}
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
