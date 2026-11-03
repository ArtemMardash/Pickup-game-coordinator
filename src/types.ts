export type Tab = 'explore' | 'my-games'

export type SkillLevel = 'Beginner' | 'Experienced'

export const SKILL_LEVELS: SkillLevel[] = ['Beginner', 'Experienced']

export type Language =
  | 'English'
  | 'Spanish'
  | 'Mandarin'
  | 'French'
  | 'Portuguese'
  | 'Other'

export const LANGUAGES: Language[] = [
  'English',
  'Spanish',
  'Mandarin',
  'French',
  'Portuguese',
  'Other',
]

export interface SportInfo {
  label: string
  emoji: string
}

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


export interface Player {
  id: string
  name: string
  initials: string
  color: string
}

export interface Game {
  id: string
  sport: SportInfo
  title: string
  startAt: string
  endAt: string
  location: string
  skillLevel: SkillLevel
  language: Language
  /** Counts joiners only — the host does not occupy a slot. */
  capacity: number
  description: string
  hostId: string
  players: Player[]
}

/** Stands in for the signed-in player until authentication exists. */
export const CURRENT_USER: Player = {
  id: 'user-me',
  name: 'Jane Doe',
  initials: 'JD',
  color: '#0284C7',
}
