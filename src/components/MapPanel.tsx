import styles from './MapPanel.module.css'

// MAP FEATURE: optional text so it can serve as the "no API key" fallback.
// With no props it renders exactly what it did before.
interface MapPanelProps {
  title?: string
  subtitle?: string
}

export function MapPanel({
  title = 'Map View Placeholder',
  subtitle = 'Interactive map lands in a later release',
}: MapPanelProps) {
  return (
    <div className={styles.map}>
      <svg
        className={styles.grid}
        width="100%"
        height="100%"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="map-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path
              d="M56 0H0V56"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
          <pattern id="map-fine" width="14" height="14" patternUnits="userSpaceOnUse">
            <path
              d="M14 0H0V14"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.4"
              opacity="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-fine)" />
        <rect width="100%" height="100%" fill="url(#map-grid)" />
        <path
          d="M-40 420 L420 160 L760 300 L1120 -60"
          fill="none"
          stroke="#a5d4ea"
          strokeWidth="26"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M120 -40 L300 520 L620 700"
          fill="none"
          stroke="#a5d4ea"
          strokeWidth="18"
          strokeLinecap="round"
          opacity="0.45"
        />
        <circle cx="300" cy="300" r="120" fill="#bfe3f3" opacity="0.35" />
        <circle cx="880" cy="520" r="160" fill="#bfe3f3" opacity="0.28" />
      </svg>

      <div className={styles.label}>
        <span className={styles.pin} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 18s6-5.2 6-9.4A6 6 0 1 0 4 8.6C4 12.8 10 18 10 18Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="8.4" r="2.1" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </span>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
    </div>
  )
}
