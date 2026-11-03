import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import styles from './Combobox.module.css'

export interface ComboboxOption {
  label: string
  emoji: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: ComboboxOption | null
  onChange: (option: ComboboxOption) => void
  label: string
  placeholder?: string
  id?: string
}

function matches(option: ComboboxOption, query: string): boolean {
  return option.label.toLowerCase().includes(query.trim().toLowerCase())
}

export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = 'Search sports…',
  id,
}: ComboboxProps) {
  const listId = useId()
  const inputId = id ?? `${listId}-input`
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query],
  )

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
        setActiveIndex(0)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const active = filtered[activeIndex]

  function commit(option: ComboboxOption) {
    onChange(option)
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
    inputRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setActiveIndex(0)
        setOpen(true)
        return
      }
      if (filtered.length === 0) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => {
        const next = index + delta
        if (next < 0) return filtered.length - 1
        if (next >= filtered.length) return 0
        return next
      })
      return
    }

    if (event.key === 'Enter') {
      if (open && active) {
        event.preventDefault()
        commit(active)
      }
      return
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
        setQuery('')
      }
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      setQuery('')
      setActiveIndex(0)
    }
  }

  const displayValue = open ? query : (value?.label ?? '')
  const showSelectedEmoji = !open && value !== null

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <div className={styles.field}>
        <span className={styles.emoji} aria-hidden="true">
          {showSelectedEmoji ? value.emoji : '🔍'}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          className={styles.input}
          value={displayValue}
          placeholder={placeholder}
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active ? `${listId}-opt-${active.label}` : undefined
          }
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        <svg
          className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
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
      </div>

      {open && (
        <ul className={styles.list} id={listId} role="listbox" aria-label={label}>
          {filtered.length === 0 ? (
            <li className={styles.empty}>No sports match “{query}”</li>
          ) : (
            filtered.map((option, index) => {
              const selected = option.label === value?.label
              return (
                <li
                  key={option.label}
                  id={`${listId}-opt-${option.label}`}
                  role="option"
                  aria-selected={selected}
                  className={[
                    styles.option,
                    index === activeIndex ? styles.optionActive : '',
                    selected ? styles.optionSelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    commit(option)
                  }}
                >
                  <span className={styles.optionEmoji} aria-hidden="true">
                    {option.emoji}
                  </span>
                  {option.label}
                  {selected && (
                    <svg
                      className={styles.check}
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 7.5L5.5 10.5L11.5 4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
