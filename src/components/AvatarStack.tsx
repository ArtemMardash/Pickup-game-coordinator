import type { Participant } from '../lib/endpoints'
import { avatarColor, initialsOf } from '../lib/avatar'
import styles from './AvatarStack.module.css'

/** Beyond this, collapse the rest into a "+N" chip. */
const MAX_SHOWN = 5

interface AvatarStackProps {
  participants: Participant[]
  /** Highlighted subtly so the current user can find themselves. */
  meId?: string
}

export function AvatarStack({ participants, meId }: AvatarStackProps) {
  if (participants.length === 0) {
    return <span className={styles.empty}>No one has joined yet</span>
  }

  const shown = participants.slice(0, MAX_SHOWN)
  const hidden = participants.length - shown.length
  const names = participants.map((p) => p.username).join(', ')

  return (
    <div className={styles.stack}>
      <div className={styles.avatars} title={names}>
        {shown.map((participant) => {
          const isMe = participant.user_id === meId
          return (
            <span
              key={participant.user_id}
              className={styles.avatar}
              style={{ background: avatarColor(participant.user_id) }}
              title={isMe ? `${participant.username} (you)` : participant.username}
            >
              {initialsOf(participant.username)}
            </span>
          )
        })}
        {hidden > 0 && <span className={styles.overflow}>+{hidden}</span>}
      </div>
      <span className={styles.label}>
        {participants.length === 1 ? '1 player' : `${participants.length} players`}
      </span>
    </div>
  )
}
