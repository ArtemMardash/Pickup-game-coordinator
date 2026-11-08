import { formatStart } from '../lib/format'
import type { GameSummary } from '../lib/endpoints'
import { sportEmoji } from '../lib/sport'
import { Button } from './ui/Button'
import { FillMeter } from './ui/FillMeter'
import { Pill } from './ui/Pill'
import styles from './GameCard.module.css'

const SKILL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

interface GameCardProps {
  game: GameSummary
  /** True when the current user is on this game's roster. */
  joined?: boolean
  onOpen?: () => void
  onEdit?: () => void
}

function CalendarIcon() {
  return (
    <svg
      className={styles.metaIcon}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 5.5H12.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4.5 1.5V3.5M9.5 1.5V3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg
      className={styles.metaIcon}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 12.5s4.5-3.9 4.5-7A4.5 4.5 0 1 0 2.5 5.5c0 3.1 4.5 7 4.5 7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="5.6" r="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function GameCard({ game, joined = false, onOpen, onEdit }: GameCardProps) {
  const editable = Boolean(onEdit)
  const emoji = sportEmoji(game.game_name)

  const body = (
    <>
      <div className={styles.topRow}>
        <Pill tone="sport">
          <span aria-hidden="true">{emoji}</span>
          {game.game_name}
        </Pill>
        <Pill tone="skill">{SKILL_LABEL[game.skill_level] ?? game.skill_level}</Pill>
        <span className={styles.meter}>
          <FillMeter
            joined={game.players_joined}
            capacity={game.capacity}
            youJoined={joined}
          />
        </span>
      </div>

      <h3 className={styles.title}>{game.title}</h3>

      <div className={styles.meta}>
        <span className={styles.metaRow}>
          <CalendarIcon />
          {formatStart(game.start_time)}
        </span>
        <span className={styles.metaRow}>
          <PinIcon />
          {game.location}
        </span>
      </div>

      {editable && (
        <div className={styles.editRow}>
          <Button
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation()
              onEdit?.()
            }}
          >
            Edit
          </Button>
        </div>
      )}
    </>
  )

  if (editable || !onOpen) {
    return <article className={styles.card}>{body}</article>
  }

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      {body}
    </button>
  )
}
