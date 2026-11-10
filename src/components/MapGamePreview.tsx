import { formatStart } from '../lib/format'
import type { GameSummary } from '../lib/endpoints'
import { isFull } from '../lib/mapGames'
import type { PinGroup } from '../lib/mapGames'
import { sportEmoji } from '../lib/sport'
import { Button } from './ui/Button'
import { Pill } from './ui/Pill'
import styles from './MapGamePreview.module.css'

/**
 * MAP FEATURE (new file, F8 / S8.1). Card shown when a pin is tapped:
 * game name, start time, skill level and spots ("6/10 joined"), with a link
 * to the full post. A pin shared by several games lists all of them.
 */
const SKILL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

interface MapGamePreviewProps {
  group: PinGroup
  onClose: () => void
  onOpenGame: (gameId: number) => void
}

function Joined({ game }: { game: GameSummary }) {
  const full = isFull(game)
  return (
    <span className={styles.joined}>
      {game.players_joined}/{game.capacity} joined
      {full ? (
        <Pill tone="full">Full</Pill>
      ) : (
        <Pill tone="open">
          {game.spots_left} {game.spots_left === 1 ? 'spot' : 'spots'} left
        </Pill>
      )}
    </span>
  )
}

export function MapGamePreview({ group, onClose, onOpenGame }: MapGamePreviewProps) {
  const multiple = group.games.length > 1
  const first = group.games[0]

  return (
    <aside className={styles.card} aria-label="Game preview">
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close preview">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {multiple ? (
        <>
          <h3 className={styles.heading}>{group.games.length} games at this location</h3>
          <p className={styles.where}>{first.location}</p>
          <ul className={styles.list}>
            {group.games.map((game) => (
              <li key={game.game_id} className={styles.row}>
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>
                    <span aria-hidden="true">{sportEmoji(game.game_name)}</span> {game.game_name}
                    {' · '}
                    {game.title}
                  </span>
                  <span className={styles.rowMeta}>
                    {formatStart(game.start_time)} · {SKILL_LABEL[game.skill_level] ?? game.skill_level}
                  </span>
                  <Joined game={game} />
                </div>
                <Button variant="secondary" onClick={() => onOpenGame(game.game_id)}>
                  View
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className={styles.pills}>
            <Pill tone="sport">
              <span aria-hidden="true">{sportEmoji(first.game_name)}</span>
              {first.game_name}
            </Pill>
            <Pill tone="skill">{SKILL_LABEL[first.skill_level] ?? first.skill_level}</Pill>
          </div>
          <h3 className={styles.heading}>{first.title}</h3>
          <p className={styles.when}>{formatStart(first.start_time)}</p>
          <p className={styles.where}>{first.location}</p>
          <Joined game={first} />
          <Button fullWidth onClick={() => onOpenGame(first.game_id)}>
            View full post
          </Button>
        </>
      )}
    </aside>
  )
}
