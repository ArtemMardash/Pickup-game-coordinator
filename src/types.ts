export type Tab = 'explore' | 'my-games'

export interface SportInfo {
  label: string
  emoji: string
}

/**
 * Emoji belongs to the sport, not the post, so the same sport always renders
 * identically and filters stay deduplicated.
 */
export const SPORTS: SportInfo[] = [
  { label: 'Archery', emoji: '🏹' },
  { label: 'Badminton', emoji: '🏸' },
  { label: 'Baseball', emoji: '⚾' },
  { label: 'Basketball', emoji: '🏀' },
  { label: 'Bowling', emoji: '🎳' },
  { label: 'Boxing', emoji: '🥊' },
  { label: 'Climbing', emoji: '🧗' },
  { label: 'Cricket', emoji: '🏏' },
  { label: 'Curling', emoji: '🥌' },
  { label: 'Cycling', emoji: '🚴' },
  { label: 'Diving', emoji: '🤿' },
  { label: 'Fencing', emoji: '🤺' },
  { label: 'Field Hockey', emoji: '🏑' },
  { label: 'Flag Football', emoji: '🏈' },
  { label: 'Frisbee', emoji: '🥏' },
  { label: 'Golf', emoji: '⛳' },
  { label: 'Gymnastics', emoji: '🤸' },
  { label: 'Handball', emoji: '🤾' },
  { label: 'Hiking', emoji: '🥾' },
  { label: 'Hockey', emoji: '🏒' },
  { label: 'Kayaking', emoji: '🛶' },
  { label: 'Lacrosse', emoji: '🥍' },
  { label: 'Martial Arts', emoji: '🥋' },
  { label: 'Pickleball', emoji: '🏓' },
  { label: 'Polo', emoji: '🐎' },
  { label: 'Rowing', emoji: '🚣' },
  { label: 'Rugby', emoji: '🏉' },
  { label: 'Running', emoji: '🏃' },
  { label: 'Sailing', emoji: '⛵' },
  { label: 'Skateboarding', emoji: '🛹' },
  { label: 'Skiing', emoji: '⛷️' },
  { label: 'Snowboarding', emoji: '🏂' },
  { label: 'Soccer', emoji: '⚽' },
  { label: 'Softball', emoji: '🥎' },
  { label: 'Surfing', emoji: '🏄' },
  { label: 'Swimming', emoji: '🏊' },
  { label: 'Tennis', emoji: '🎾' },
  { label: 'Volleyball', emoji: '🏐' },
  { label: 'Walking', emoji: '🚶' },
  { label: 'Water Polo', emoji: '🤽' },
  { label: 'Weightlifting', emoji: '🏋️' },
  { label: 'Yoga', emoji: '🧘' },
]

/** Languages offered in the create/edit form. */
export const LANGUAGES = [
  'English',
  'Spanish',
  'Mandarin',
  'French',
  'Portuguese',
  'Other',
]
