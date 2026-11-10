import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { fetchSuggestions, geocodeText, resolveSuggestion } from '../lib/geocode'
import type { GeoResult, PlaceSuggestion } from '../lib/geocode'
import styles from './PlaceInput.module.css'

/**
 * MAP FEATURE (new file). Text input with Google Places autocomplete.
 * Shared by the area search bar (F9) and the Location filter (S10.3).
 *
 * Reports exactly one outcome per submit:
 *   found      -> onResolved(result)
 *   not found  -> onResolved(null)      ("Location not found")
 *   API error  -> onError(message)
 */
interface PlaceInputProps {
  value: string
  onChange: (text: string) => void
  onResolved: (result: GeoResult | null, text: string) => void
  onError?: (message: string) => void
  placeholder?: string
  ariaLabel: string
  inputClassName?: string
  disabled?: boolean
  autoFocus?: boolean
}

export function PlaceInput({
  value,
  onChange,
  onResolved,
  onError,
  placeholder,
  ariaLabel,
  inputClassName,
  disabled = false,
  autoFocus = false,
}: PlaceInputProps) {
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  // The text the current `suggestions` were fetched for. While the user keeps
  // typing the old list stays on screen, but Enter must not pick from it.
  const [fetchedFor, setFetchedFor] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [busy, setBusy] = useState(false)
  // Set when the text changed because a suggestion was picked, so picking
  // doesn't immediately trigger another autocomplete request.
  const skipNextFetch = useRef(false)
  // The text that was last submitted. A debounced/in-flight autocomplete for
  // that same text must not re-open the list after the user pressed Enter.
  const lastSubmitted = useRef('')

  // Debounced autocomplete. A stale response is ignored via `active`.
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
    if (disabled || value.trim().length < 2) {
      setSuggestions([])
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      fetchSuggestions(value)
        .then((next) => {
          if (!active || lastSubmitted.current === value) return
          setSuggestions(next)
          setFetchedFor(value)
          setHighlight(-1)
          setOpen(next.length > 0)
        })
        .catch(() => {
          // Autocomplete is a convenience; submitting still geocodes the text.
          if (active) setSuggestions([])
        })
    }, 220)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [value, disabled])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  async function submit(suggestion?: PlaceSuggestion) {
    const text = suggestion?.text ?? value
    if (!text.trim() || busy) return
    lastSubmitted.current = text
    setOpen(false)
    setBusy(true)
    try {
      const result = suggestion ? await resolveSuggestion(suggestion) : await geocodeText(text)
      if (suggestion) {
        skipNextFetch.current = true
        onChange(result?.label ?? suggestion.text)
      }
      onResolved(result, text)
    } catch {
      onError?.('Place search is unavailable right now. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault()
      setOpen(true)
      setHighlight((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault()
      setHighlight((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const useHighlighted = open && highlight >= 0 && fetchedFor === value
      void submit(useHighlighted ? suggestions[highlight] : undefined)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <input
        type="search"
        className={inputClassName ?? styles.input}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-busy={busy}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <ul className={styles.list} id={listId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              role="option"
              aria-selected={index === highlight}
              className={`${styles.option} ${index === highlight ? styles.optionActive : ''}`}
              // mousedown (not click) so the pick lands before the input blurs
              onMouseDown={(event) => {
                event.preventDefault()
                void submit(suggestion)
              }}
              onMouseEnter={() => setHighlight(index)}
            >
              <span className={styles.main}>{suggestion.main}</span>
              {suggestion.secondary && (
                <span className={styles.secondary}>{suggestion.secondary}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
