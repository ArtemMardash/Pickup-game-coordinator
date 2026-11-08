import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { isoToLocalInput, plusHoursLocalInput } from '../lib/datetime'
import type { ApiSkillLevel, GameDetail } from '../lib/endpoints'
import { EMPTY_FORM, validateGameForm } from '../lib/gameForm'
import type { GameFormErrors, GameFormValues } from '../lib/gameForm'
import { LANGUAGES, SPORTS } from '../types'
import { Button } from './ui/Button'
import { Combobox } from './ui/Combobox'
import type { ComboboxOption } from './ui/Combobox'
import styles from './GameModal.module.css'

export type ModalMode = 'create' | 'edit'

const SKILL_OPTIONS: { value: ApiSkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

function toFormValues(game: GameDetail): GameFormValues {
  return {
    title: game.title,
    gameName: game.game_name,
    startTime: isoToLocalInput(game.start_time),
    endTime: isoToLocalInput(game.end_time),
    location: game.location,
    skillLevel: game.skill_level,
    capacity: String(game.capacity),
    language: game.language,
    description: game.description ?? '',
  }
}

interface GameModalProps {
  mode: ModalMode
  /** Required in edit mode; the form starts from these values. */
  initial?: GameDetail | null
  onSubmit: (values: GameFormValues) => Promise<void>
  onClose: () => void
}

export function GameModal({ mode, initial, onSubmit, onClose }: GameModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [values, setValues] = useState<GameFormValues>(() =>
    initial ? toFormValues(initial) : EMPTY_FORM,
  )
  const [errors, setErrors] = useState<GameFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sportOptions = useMemo(
    () => SPORTS.map((sport) => ({ label: sport.label, emoji: sport.emoji })),
    [],
  )
  const selectedSport: ComboboxOption | null = values.gameName
    ? {
        label: values.gameName,
        emoji: SPORTS.find((s) => s.label === values.gameName)?.emoji ?? '🏅',
      }
    : null

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button',
    )
    focusable?.focus()
  }, [])

  function update<K extends keyof GameFormValues>(key: K, value: GameFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      // Picking a start with no end yet suggests a one-hour game.
      if (key === 'startTime' && value && !current.endTime) {
        next.endTime = plusHoursLocalInput(value as string, 1)
      }
      return next
    })
    // A start change can invalidate or repair the end, so clear both.
    if (key === 'startTime') {
      setErrors((current) => ({ ...current, startTime: undefined, endTime: undefined }))
      return
    }
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validateGameForm(values)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setFormError(null)
      return
    }

    setBusy(true)
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save this game')
    } finally {
      setBusy(false)
    }
  }

  const isEdit = mode === 'edit'

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <form onSubmit={handleSubmit}>
          <div className={styles.header}>
            <h2 className={styles.title} id={titleId}>
              {isEdit ? 'Edit Game Post' : 'Create a New Game Post'}
            </h2>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M3 3L11 11M11 3L3 11"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className={styles.form}>
            {formError && (
              <p className={styles.formError} role="alert">
                {formError}
              </p>
            )}

            <div className={styles.field}>
              <span className={styles.label}>
                Sport <span className={styles.required}>*</span>
              </span>
              <Combobox
                options={sportOptions}
                value={selectedSport}
                onChange={(option) => update('gameName', option.label)}
                label="Sport"
              />
              {errors.gameName && <span className={styles.error}>{errors.gameName}</span>}
            </div>

            <label className={styles.field}>
              <span className={styles.label}>
                Game Name <span className={styles.required}>*</span>
              </span>
              <input
                className={`${styles.input} ${errors.title ? styles.invalid : ''}`}
                type="text"
                value={values.title}
                maxLength={120}
                onChange={(event) => update('title', event.target.value)}
              />
              {errors.title && <span className={styles.error}>{errors.title}</span>}
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>
                  Starts <span className={styles.required}>*</span>
                </span>
                <input
                  className={`${styles.input} ${errors.startTime ? styles.invalid : ''}`}
                  type="datetime-local"
                  value={values.startTime}
                  onChange={(event) => update('startTime', event.target.value)}
                />
                {errors.startTime && <span className={styles.error}>{errors.startTime}</span>}
              </label>

              <label className={styles.field}>
                <span className={styles.label}>
                  Ends <span className={styles.required}>*</span>
                </span>
                <input
                  className={`${styles.input} ${errors.endTime ? styles.invalid : ''}`}
                  type="datetime-local"
                  value={values.endTime}
                  onChange={(event) => update('endTime', event.target.value)}
                />
                {errors.endTime && <span className={styles.error}>{errors.endTime}</span>}
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>
                Location <span className={styles.required}>*</span>
              </span>
              <input
                className={`${styles.input} ${errors.location ? styles.invalid : ''}`}
                type="text"
                value={values.location}
                maxLength={255}
                onChange={(event) => update('location', event.target.value)}
              />
              {errors.location && <span className={styles.error}>{errors.location}</span>}
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Skill Level</span>
                <select
                  className={styles.select}
                  value={values.skillLevel}
                  onChange={(event) =>
                    update('skillLevel', event.target.value as ApiSkillLevel)
                  }
                >
                  {SKILL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>
                  Players Needed <span className={styles.required}>*</span>
                </span>
                <input
                  className={`${styles.input} ${errors.capacity ? styles.invalid : ''}`}
                  type="number"
                  min={1}
                  max={1000}
                  value={values.capacity}
                  onChange={(event) => update('capacity', event.target.value)}
                />
                {errors.capacity && <span className={styles.error}>{errors.capacity}</span>}
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Language</span>
              <select
                className={styles.select}
                value={values.language}
                onChange={(event) => update('language', event.target.value)}
              >
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Description</span>
              <textarea
                className={`${styles.textarea} ${errors.description ? styles.invalid : ''}`}
                value={values.description}
                maxLength={2000}
                onChange={(event) => update('description', event.target.value)}
              />
              {errors.description && (
                <span className={styles.error}>{errors.description}</span>
              )}
            </label>

            <p className={styles.hint}>
              Counts you as one of them.
            </p>
          </div>

          <div className={styles.actions}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <div className={styles.spacer} />
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
