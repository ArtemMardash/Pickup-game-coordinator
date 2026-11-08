import { useEffect, useId, useRef, useState } from 'react'
import styles from './FilterMenu.module.css'

export interface FilterOption {
  value: string
  label: string
  emoji?: string
}

interface FilterMenuProps {
  label: string
  options: FilterOption[]
  /** Empty means the filter is off. */
  selected: string[]
  onChange: (next: string[]) => void
  /** Single-select closes on pick; multi-select stays open. */
  multiple?: boolean
}

function Check({ checked, radio }: { checked: boolean; radio?: boolean }) {
  return (
    <span
      className={[
        styles.box,
        radio ? styles.radio : '',
        checked ? styles.boxChecked : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6.2L4.7 8.9L10 3.2"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

export function FilterMenu({
  label,
  options,
  selected,
  onChange,
  multiple = true,
}: FilterMenuProps) {
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

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

  function toggle(value: string) {
    if (!multiple) {
      onChange(selected.includes(value) ? [] : [value])
      setOpen(false)
      return
    }
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    )
  }

  const triggerText =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${label} (${selected.length})`

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${selected.length > 0 ? styles.triggerActive : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{triggerText}</span>
        {multiple && selected.length > 1 && (
          <span className={styles.badge}>{selected.length}</span>
        )}
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
        <div className={styles.panel} id={listId} role="listbox" aria-multiselectable={multiple}>
          {options.map((option) => {
            const isSelected = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                onClick={() => toggle(option.value)}
              >
                <Check checked={isSelected} radio={!multiple} />
                {option.emoji && (
                  <span className={styles.emoji} aria-hidden="true">
                    {option.emoji}
                  </span>
                )}
                <span>{option.label}</span>
              </button>
            )
          })}

          {multiple && selected.length > 0 && (
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  onChange([])
                  setOpen(false)
                }}
              >
                Clear {label.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
