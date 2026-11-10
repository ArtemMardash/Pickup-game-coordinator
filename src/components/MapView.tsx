import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameSummary } from '../lib/endpoints'
import type { LocationFilter } from '../lib/filters'
import { mapsConfigured } from '../lib/googleMaps'
import { groupPins } from '../lib/mapGames'
import type { AreaSearchEvent } from './AreaSearch'
import { GameCard } from './GameCard'
import { GameMap } from './GameMap'
import { MapPanel } from './MapPanel'
import styles from './MapView.module.css'

/**
 * MAP FEATURE (new file). Replaces <MapPanel /> in the split layout.
 *
 * Two layouts, ONE map:
 *   compact  - the panel beside the game list (what MapPanel used to fill)
 *   expanded - the map takes over the content area, below the nav and filter
 *              bar, with the game list as a sidebar. The nav search bar and
 *              the filter bar stay on screen, so search, filters and sort
 *              work identically in both layouts and drive the same query.
 */
interface MapViewProps {
  /** The games shown in the list: filtered and sorted by the server. */
  games: GameSummary[]
  joinedIds: Set<number>
  loading: boolean
  area: AreaSearchEvent | null
  radius: LocationFilter | null
  filtersActive: boolean
  onClearFilters: () => void
  onOpenGame: (gameId: number) => void
}

export function MapView({
  games,
  joinedIds,
  loading,
  area,
  radius,
  filtersActive,
  onClearFilters,
  onOpenGame,
}: MapViewProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const groups = useMemo(() => groupPins(games), [games])
  const selected = groups.find((g) => g.key === selectedKey) ?? null
  const pinned = groups.reduce((sum, g) => sum + g.games.length, 0)

  /** "View full post": leave the expanded view so the post opens beside the list. */
  const openGame = useCallback(
    (gameId: number) => {
      setExpanded(false)
      setSelectedKey(null)
      onOpenGame(gameId)
    },
    [onOpenGame],
  )

  /** Sidebar card: show the game on the map; open it directly if it has no pin. */
  function focusGame(game: GameSummary) {
    const group = groups.find((g) => g.games.some((x) => x.game_id === game.game_id))
    if (group) setSelectedKey(group.key)
    else openGame(game.game_id)
  }

  // Escape collapses the expanded map. Document-level, because focus is often
  // on <body> after clicking the map. Escape inside a text field or an open
  // menu is left to that control (it closes its own dropdown first).
  useEffect(() => {
    if (!expanded) return
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      const target = event.target as HTMLElement | null
      // (the Collapse button is itself aria-expanded, so exclude it explicitly)
      if (target?.closest('input, textarea, select, [aria-expanded="true"]:not([data-map-toggle])')) return
      setExpanded(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  // Hooks are above; with no API key, show the original placeholder instead.
  if (!mapsConfigured()) {
    return (
      <MapPanel
        title="Map unavailable"
        subtitle="Add VITE_GOOGLE_MAPS_API_KEY to your .env file to turn on the map"
      />
    )
  }

  return (
    // The structure below is identical in both layouts (only the class
    // changes), so React keeps the same <GameMap> mounted when toggling.
    <div
      className={expanded ? styles.overlay : styles.inline}
      role={expanded ? 'region' : undefined}
      aria-label={expanded ? 'Expanded map' : undefined}
    >
      {expanded ? (
        <aside className={styles.sidebar} aria-label="Games on the map">
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>
              {games.length} {games.length === 1 ? 'game' : 'games'}
            </h2>
            {games.length > pinned && (
              <span className={styles.sidebarNote}>
                {games.length - pinned} without a map pin (online or no address match)
              </span>
            )}
          </div>
          <div className={styles.sidebarList}>
            {games.length === 0 ? (
              <p className={styles.sidebarEmpty}>
                {filtersActive ? 'No games match your filters.' : 'No games to show.'}
              </p>
            ) : (
              games.map((game) => (
                <GameCard
                  key={game.game_id}
                  game={game}
                  joined={joinedIds.has(game.game_id)}
                  onOpen={() => focusGame(game)}
                />
              ))
            )}
          </div>
        </aside>
      ) : null}

      <div className={styles.mapSlot}>
        <GameMap
          groups={groups}
          gamesLoading={loading}
          expanded={expanded}
          area={area}
          radius={radius}
          filtersActive={filtersActive}
          onClearFilters={onClearFilters}
          selected={selected}
          onSelectKey={setSelectedKey}
          onOpenGame={openGame}
        >
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            data-map-toggle=""
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </GameMap>
      </div>
    </div>
  )
}
