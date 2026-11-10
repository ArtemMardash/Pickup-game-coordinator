import { useEffect, useId, useRef, useState } from 'react'
import { DISTANCE_OPTIONS } from '../lib/filters'
import type { LocationFilter as LocationValue } from '../lib/filters'
import { mapsConfigured } from '../lib/googleMaps'
import type { GeoResult } from '../lib/geocode'
import { PlaceInput } from './PlaceInput'
import styles from './LocationFilter.module.css'

/**
 * MAP FEATURE (new file, S10.3). "Location" filter: enter an area, choose a
 * distance (5 / 10 / 25 miles). Only offline games in range are shown; online
 * games have no location so they are hidden while this is on.
 * Looks and behaves like the other FilterMenu buttons in the filter bar.
 */
interface LocationFilterProps {
  value: LocationValue | null
  onChange: (next: LocationValue | null) => void
}

export function LocationFilter({ value, onChange }: LocationFilterProps) {
  const panelId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value?.label ?? '')
  const [picked, setPicked] = useState<GeoResult | null>(null)
  const [miles, setMiles] = useState(value?.miles ?? DISTANCE_OPTIONS[1])
  const [message, setMessage] = useState<string | null>(null)
  const enabled = mapsConfigured()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // "Clear all" in the filter bar resets `value` from outside; mirror that.
  useEffect(() => {
    if (value === null) {
      setText('')
      setPicked(null)
    }
  }, [value])

  function apply() {
    const target = picked ?? (value ? { lat: value.lat, lng: value.lng, label: value.label } : null)
    if (!target) {
      setMessage('Enter an area first.')
      return
    }
    onChange({ label: target.label, lat: target.lat, lng: target.lng, miles })
    setOpen(false)
  }

  const shortLabel = value ? value.label.split(',')[0] : ''

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${value ? styles.triggerActive : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={!enabled}
        title={enabled ? undefined : 'Set VITE_GOOGLE_MAPS_API_KEY to enable the location filter'}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value ? `${shortLabel} · ${value.miles} mi` : 'Location'}</span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className={styles.panel} id={panelId} role="dialog" aria-label="Filter by location">
          <label className={styles.label}>
            <span>Area</span>
            <PlaceInput
              value={text}
              onChange={(next) => {
                setText(next)
                setPicked(null)
                setMessage(null)
              }}
              onResolved={(result) => {
                if (!result) {
                  setPicked(null)
                  setMessage('Location not found')
                  return
                }
                setPicked(result)
                setMessage(null)
              }}
              onError={setMessage}
              placeholder="City, neighborhood, or address"
              ariaLabel="Area for the location filter"
              autoFocus
            />
          </label>

          <fieldset className={styles.distances}>
            <legend className={styles.legend}>Within</legend>
            {DISTANCE_OPTIONS.map((option) => (
              <label
                key={option}
                className={`${styles.distance} ${miles === option ? styles.distanceOn : ''}`}
              >
                <input
                  type="radio"
                  name={`${panelId}-miles`}
                  className="visually-hidden"
                  checked={miles === option}
                  onChange={() => setMiles(option)}
                />
                {option} mi
              </label>
            ))}
          </fieldset>

          {message && (
            <p className={styles.message} role="alert">
              {message}
            </p>
          )}

          <div className={styles.actions}>
            {value && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  onChange(null)
                  setMessage(null)
                  setOpen(false)
                }}
              >
                Clear location
              </button>
            )}
            <button type="button" className={styles.apply} onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
