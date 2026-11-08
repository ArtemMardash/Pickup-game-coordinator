import type { ApiSkillLevel } from './endpoints'

/** Mirrors the backend's limits so mistakes surface before a round trip. */
export const MAX_GAME_HOURS = 6

export interface GameFormValues {
  title: string
  gameName: string
  startTime: string
  endTime: string
  location: string
  skillLevel: ApiSkillLevel
  capacity: string
  language: string
  description: string
}

export type GameFormErrors = Partial<Record<keyof GameFormValues, string>>

export const EMPTY_FORM: GameFormValues = {
  title: '',
  gameName: '',
  startTime: '',
  endTime: '',
  location: '',
  skillLevel: 'beginner',
  capacity: '10',
  language: 'English',
  description: '',
}

export function validateGameForm(values: GameFormValues): GameFormErrors {
  const errors: GameFormErrors = {}

  const title = values.title.trim()
  if (!title) errors.title = 'Enter a title.'
  else if (title.length > 120) errors.title = 'Use 120 characters or fewer.'

  const gameName = values.gameName.trim()
  if (!gameName) errors.gameName = 'Pick a sport.'
  else if (gameName.length > 60) errors.gameName = 'Use 60 characters or fewer.'

  const location = values.location.trim()
  if (!location) errors.location = 'Enter a location.'
  else if (location.length > 255) errors.location = 'Use 255 characters or fewer.'

  const capacity = Number(values.capacity)
  if (!values.capacity.trim() || !Number.isFinite(capacity)) {
    errors.capacity = 'Enter a number.'
  } else if (!Number.isInteger(capacity)) {
    errors.capacity = 'Use a whole number.'
  } else if (capacity < 1 || capacity > 1000) {
    errors.capacity = 'Must be between 1 and 1000.'
  }

  if (!values.startTime) {
    errors.startTime = 'Pick a start time.'
  }
  if (!values.endTime) {
    errors.endTime = 'Pick an end time.'
  }

  if (values.startTime && values.endTime) {
    const start = new Date(values.startTime)
    const end = new Date(values.endTime)

    if (Number.isNaN(start.getTime())) {
      errors.startTime = 'Invalid date.'
    } else if (Number.isNaN(end.getTime())) {
      errors.endTime = 'Invalid date.'
    } else if (end <= start) {
      errors.endTime = 'Must be after the start time.'
    } else if (end.getTime() - start.getTime() > MAX_GAME_HOURS * 3_600_000) {
      errors.endTime = `A game cannot last longer than ${MAX_GAME_HOURS} hours.`
    } else if (end.getTime() <= Date.now()) {
      errors.endTime = 'Must be in the future.'
    }
  }

  if (values.description.length > 2000) {
    errors.description = 'Use 2000 characters or fewer.'
  }

  return errors
}
