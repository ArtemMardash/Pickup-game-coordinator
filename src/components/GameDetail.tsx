import { formatRange } from '../lib/format'
import { sportEmoji } from '../lib/sport'
import type { GameDetail as GameDetailData } from '../lib/endpoints'
import { AvatarStack } from './AvatarStack'
import { Button } from './ui/Button'
import { Pill } from './ui/Pill'
import styles from './GameDetail.module.css'

/** Display-only capitalisation; the API sends lowercase levels. */
const SKILL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export type JoinState = 'can-join' | 'joined' | 'full' | 'organizer' | 'pending'

interface GameDetailProps {
  game: GameDetailData
  joinedCount: number
  joinState: JoinState
  description?: string | null
  onBack: () => void
  onJoin: () => void
  onLeave: () => void
  onDelete: () => void
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M8.5 3L4.5 7L8.5 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>
        {icon}
        {label}
      </span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  )
}

const iconProps = {
  width: 13,
  height: 13,
  viewBox: '0 0 14 14',
  fill: 'none',
  'aria-hidden': true,
} as const

function ActionButton({
  joinState,
  onJoin,
  onLeave,
  onDelete,
}: Pick<GameDetailProps, 'joinState' | 'onJoin' | 'onLeave' | 'onDelete'>) {
  switch (joinState) {
    case 'organizer':
      return (
        <Button variant="danger" size="lg" fullWidth onClick={onDelete}>
          Cancel Game
        </Button>
      )
    case 'joined':
      return (
        <Button variant="secondary" size="lg" fullWidth onClick={onLeave}>
          Leave Game
        </Button>
      )
    case 'full':
      return (
        <Button variant="disabled" size="lg" fullWidth disabled>
          Game Full
        </Button>
      )
    case 'pending':
      return (
        <Button variant="primary" size="lg" fullWidth disabled>
          Working…
        </Button>
      )
    case 'can-join':
      return (
        <Button variant="primary" size="lg" fullWidth onClick={onJoin}>
          Join Game
        </Button>
      )
  }
}

export function GameDetail({
  game,
  joinedCount,
  joinState,
  description,
  onBack,
  onJoin,
  onLeave,
  onDelete,
}: GameDetailProps) {
  const full = joinState === 'full'
  const emoji = sportEmoji(game.game_name)

  return (
    <article className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>
        <BackIcon />
        Back to List
      </button>

      <h2 className={styles.title}>{game.title}</h2>

      <div className={styles.tags}>
        <Pill tone="sport">
          <span aria-hidden="true">{emoji}</span>
          {game.game_name}
        </Pill>
        <Pill tone="skill">{SKILL_LABEL[game.skill_level] ?? game.skill_level}</Pill>
        <Pill tone={full ? 'full' : 'open'}>
          {game.is_online ? 'Online' : game.status === 'active' ? 'In progress' : 'Upcoming'}
        </Pill>
      </div>

      <div className={styles.rows}>
        <Row
          label="Date & Time"
          icon={
            <svg {...iconProps}>
              <rect
                x="1.5"
                y="2.5"
                width="11"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path d="M1.5 5.5H12.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          }
        >
          {formatRange(game.start_time, game.end_time)}
        </Row>

        <Row
          label="Location"
          icon={
            <svg {...iconProps}>
              <path
                d="M7 12.5s4.5-3.9 4.5-7A4.5 4.5 0 1 0 2.5 5.5c0 3.1 4.5 7 4.5 7Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle cx="7" cy="5.6" r="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          }
        >
          {game.location}
        </Row>

        <Row
          label="Language"
          icon={
            <svg {...iconProps}>
              <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M1.9 7h10.2M7 1.8c1.4 1.6 2.1 3.4 2.1 5.2S8.4 10.6 7 12.2C5.6 10.6 4.9 8.8 4.9 7S5.6 3.4 7 1.8Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          }
        >
          {game.language}
        </Row>

        <Row
          label="Organizer"
          icon={
            <svg {...iconProps}>
              <circle cx="7" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M2.4 12.4c0-2.2 2-3.9 4.6-3.9s4.6 1.7 4.6 3.9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          }
        >
          {game.organizer_username}
        </Row>

        {description && (
          <Row
            label="Description"
            icon={
              <svg {...iconProps}>
                <path
                  d="M2.5 3.5h9M2.5 6.5h9M2.5 9.5h5.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            }
          >
            <span className={styles.description}>{description}</span>
          </Row>
        )}
      </div>

      <div className={styles.roster}>
        <span className={styles.rosterCount}>
          Players: {joinedCount}/{game.capacity}
        </span>
        {full && <Pill tone="full">Full</Pill>}
      </div>

      <AvatarStack participants={game.participants} />

      <div className={styles.action}>
        <ActionButton
          joinState={joinState}
          onJoin={onJoin}
          onLeave={onLeave}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}
