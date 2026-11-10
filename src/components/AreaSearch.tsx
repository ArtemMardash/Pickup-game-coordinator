import { useState } from 'react'
import { mapsConfigured } from '../lib/googleMaps'
import type { GeoResult } from '../lib/geocode'
import { PlaceInput } from './PlaceInput'
import styles from './AreaSearch.module.css'

/**
 * MAP FEATURE (new file, F9 / S9.1). The search bar in the top nav. Searching
 * a city, neighborhood or address MOVES THE MAP there; it does not filter the
 * list (distance filtering is the separate Location filter).
 *
 * Each search is reported as an event with a fresh `id` so searching the same
 * place twice still re-centers the map.
 */
export interface AreaSearchEvent {
  id: number
  /** null = the text matched no real place ("Location not found"). */
  result: GeoResult | null
  /** Set when the lookup itself failed (network, quota, key). */
  error?: string
}

interface AreaSearchProps {
  onSearch: (event: AreaSearchEvent) => void
}

export function AreaSearch({ onSearch }: AreaSearchProps) {
  const [text, setText] = useState('')
  const enabled = mapsConfigured()

  return (
    <div className={styles.search} title={enabled ? undefined : 'Set VITE_GOOGLE_MAPS_API_KEY to enable search'}>
      <div className={styles.field}>
        <svg
          className={styles.icon}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10.8 10.8L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <PlaceInput
          value={text}
          onChange={setText}
          onResolved={(result) => onSearch({ id: Date.now(), result })}
          onError={(error) => onSearch({ id: Date.now(), result: null, error })}
          placeholder="Search by city, neighborhood, or address..."
          ariaLabel="Search games by city, neighborhood, or address"
          inputClassName={styles.input}
          disabled={!enabled}
        />
      </div>
    </div>
  )
}
