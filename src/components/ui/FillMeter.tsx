import styles from './FillMeter.module.css'

interface FillMeterProps {
  joined: number
  capacity: number
  youJoined?: boolean
}

// Occupancy readout: [check] joined/capacity [person icon].
export function FillMeter({ joined, capacity, youJoined = false }: FillMeterProps) {
  const full = capacity > 0 && joined >= capacity

  const label = `${joined} of ${capacity} players joined${youJoined ? ', including you' : ''}`

  return (
    <span className={styles.meter}>
      {youJoined && (
        <svg
          className={styles.check}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 6.3L4.7 9L10 3.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span
        className={`${styles.value} ${full ? styles.full : ''}`}
        aria-hidden="true"
      >
        {joined}/{capacity}
      </span>
      <svg
        className={styles.icon}
        width="11"
        height="13"
        viewBox="0 0 12 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="6" cy="3.4" r="2.7" />
        <path d="M0.6 15.4c0-3.2 2.4-5.5 5.4-5.5s5.4 2.3 5.4 5.5z" />
      </svg>
      {/*
        Real text, not aria-label: a plain <span> is role="generic", which does
        not support aria-label, so the label would be dropped.
      */}
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
