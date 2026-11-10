import { useCallback, useEffect, useMemo, useState } from 'react'
import { AreaSearch } from './components/AreaSearch' // MAP FEATURE
import type { AreaSearchEvent } from './components/AreaSearch' // MAP FEATURE
import { AuthGate } from './components/AuthGate'
import { FilterBar } from './components/FilterBar'
import { GameCard } from './components/GameCard'
import { GameDetail } from './components/GameDetail'
import type { JoinState } from './components/GameDetail'
import { GameModal } from './components/GameModal'
import type { ModalMode } from './components/GameModal'
import { MapView } from './components/MapView' // MAP FEATURE: replaces MapPanel here
import { TopNav } from './components/TopNav'
import { activeFilterCount, EMPTY_FILTERS, toQuery } from './lib/filters'
import type { Filters } from './lib/filters'
import { localInputToIso } from './lib/datetime'
import { coordinatesForPost } from './lib/geocode' // MAP FEATURE
import type { GameFormValues } from './lib/gameForm'
import { useAuth } from './state/authContext'
import type { GameDetail as GameDetailData } from './lib/endpoints'
import type { Tab } from './types'
import { useFilterOptions } from './state/useFilterOptions' // MAP FEATURE
import { useGames } from './state/useGames'
import styles from './App.module.css'

/** Form values -> the JSON body both POST and PATCH accept. */
function toRequestBody(values: GameFormValues) {
  return {
    title: values.title.trim(),
    game_name: values.gameName.trim(),
    start_time: localInputToIso(values.startTime),
    end_time: localInputToIso(values.endTime),
    location: values.location.trim(),
    skill_level: values.skillLevel,
    capacity: Number(values.capacity),
    language: values.language,
    description: values.description.trim() || undefined,
  }
}

function Dashboard() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const query = useMemo(() => toQuery(filters), [filters])
  const {
    games,
    joinedIds,
    status,
    error,
    reload,
    version, // MAP FEATURE
    detail,
    join,
    leave,
    remove,
    create,
    update,
  } = useGames(query)
  // MAP FEATURE (S10.1 / S10.4): filter menus list what is actually posted.
  const filterOptions = useFilterOptions(version)
  // MAP FEATURE (F9): the latest search-bar search; the map moves to it.
  const [area, setArea] = useState<AreaSearchEvent | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('explore')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modal, setModal] = useState<{ mode: ModalMode; game: GameDetailData | null } | null>(
    null,
  )

  /**
   * Switching tabs drops the open detail view and any active filters. My Games
   * hides the filter bar, so stale filters would silently narrow that list with
   * no way to see or clear them.
   */
  const changeTab = useCallback((tab: Tab) => {
    setActiveTab(tab)
    setSelectedId(null)
    setFilters(EMPTY_FILTERS)
  }, [])
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

  /**
   * My Games lists what you host; Explore lists what you could join. A game you
   * host is not discoverable to you, and showing it in both places would make
   * its "joined" checkmark ambiguous with a game you actually joined.
   */
  const visibleGames = useMemo(
    () =>
      activeTab === 'my-games'
        ? games.filter((g) => g.organizer_id === meId)
        : games.filter((g) => g.organizer_id !== meId),
    [games, activeTab, meId],
  )

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

  /** Open the editor for a hosted game, fetching its full detail first. */
  async function openEditor(gameId: number) {
    try {
      const data = await detail(gameId)
      setModal({ mode: 'edit', game: data })
    } catch (cause) {
      setLoaded({
        id: gameId,
        data: null,
        error: cause instanceof Error ? cause.message : 'Could not load this game',
      })
      setSelectedId(gameId)
    }
  }

  async function submitModal(values: GameFormValues) {
    // MAP FEATURE: geocode the address once, when the post is saved, so it can
    // be pinned. On edit this also re-sends the existing coordinates, because
    // the backend clears them whenever `location` is sent without any.
    // Never blocks saving: a post that can't be geocoded just has no pin.
    const coords = await coordinatesForPost(
      values.location,
      modal?.mode === 'edit' ? modal.game : null,
    )
    const body = { ...toRequestBody(values), ...coords }
    if (modal?.mode === 'edit' && modal.game) {
      await update(modal.game.game_id, body)
      if (selectedId === modal.game.game_id) await load(modal.game.game_id)
    } else {
      await create(body)
    }
    setModal(null)
  }

  return (
    <div className={`${styles.app} ${activeTab === 'my-games' ? styles.noFilterBar : ''}`}>
      <TopNav
        activeTab={activeTab}
        onTabChange={changeTab}
        onCreatePost={() => setModal({ mode: 'create', game: null })}
        search={<AreaSearch onSearch={setArea} />} // MAP FEATURE (F9)
      />
      {activeTab === 'explore' && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          availableSports={filterOptions?.sports} // MAP FEATURE
          availableLanguages={filterOptions?.languages} // MAP FEATURE
        />
      )}

      <main className={styles.main}>
        <div className={styles.split}>
          <section className={styles.feedColumn} aria-label="Game feed">
            <div className={styles.sectionHeader}>
              <h2 className={styles.heading}>
                {selectedId !== null
                  ? 'Game details'
                  : activeTab === 'my-games'
                    ? 'Games you are hosting'
                    : 'Games near you'}
              </h2>
              <span className={styles.count}>
                {visibleGames.length} {activeTab === 'my-games' ? 'hosting' : 'games'}
              </span>
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
              ) : visibleGames.length === 0 ? (
                <div className={styles.notice}>
                  {activeTab === 'my-games'
                    ? 'No pickup games created yet. Click "+ Create Post" to get started!'
                    : activeFilterCount(filters) > 0
                      ? 'No games match these filters.'
                      : games.length > 0
                        ? 'No other games to join right now. You are hosting every game listed.'
                        : 'No games yet. Create the first one.'}
                  {activeTab === 'explore' && activeFilterCount(filters) > 0 && (
                    <button
                      type="button"
                      className={styles.retry}
                      onClick={() => setFilters(EMPTY_FILTERS)}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                visibleGames.map((game) => (
                  <GameCard
                    key={game.game_id}
                    game={game}
                    joined={joinedIds.has(game.game_id)}
                    onOpen={
                      activeTab === 'my-games'
                        ? undefined
                        : () => setSelectedId(game.game_id)
                    }
                    onEdit={
                      activeTab === 'my-games'
                        ? () => void openEditor(game.game_id)
                        : undefined
                    }
                    onDelete={
                      activeTab === 'my-games'
                        ? () => void run(() => remove(game.game_id))
                        : undefined
                    }
                  />
                ))
              )}
            </div>
          </section>

          <section className={styles.mapPanel} aria-label="Map">
            {/* MAP FEATURE: Google Map (compact here, expandable). Gets the same
                list the cards use, so pins and cards always match (S10.5). */}
            <MapView
              games={visibleGames}
              joinedIds={joinedIds}
              loading={status === 'loading'}
              area={area}
              radius={filters.location}
              filtersActive={activeFilterCount(filters) > 0}
              onClearFilters={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
              onOpenGame={setSelectedId}
            />
          </section>
        </div>
      </main>

      {modal && (
        <GameModal
          mode={modal.mode}
          initial={modal.game}
          onSubmit={submitModal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function App() {
  const { status } = useAuth()

  if (status !== 'authenticated') return <AuthGate />

  return <Dashboard />
}

export default App
