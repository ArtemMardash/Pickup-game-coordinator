import { CURRENT_USER } from '../types'
import type { Game, Player } from '../types'

const PLAYER_POOL: Player[] = [
  { id: 'p-aria', name: 'Aria Bennett', initials: 'AB', color: '#7C3AED' },
  { id: 'p-marcus', name: 'Marcus Lee', initials: 'ML', color: '#0891B2' },
  { id: 'p-sofia', name: 'Sofia Ramos', initials: 'SR', color: '#DB2777' },
  { id: 'p-devon', name: 'Devon Clarke', initials: 'DC', color: '#EA580C' },
  { id: 'p-nina', name: 'Nina Patel', initials: 'NP', color: '#059669' },
  { id: 'p-tyler', name: 'Tyler Brooks', initials: 'TB', color: '#4F46E5' },
  { id: 'p-hana', name: 'Hana Kim', initials: 'HK', color: '#C026D3' },
  { id: 'p-omar', name: 'Omar Haddad', initials: 'OH', color: '#0D9488' },
  { id: 'p-lena', name: 'Lena Fischer', initials: 'LF', color: '#B45309' },
  { id: 'p-raj', name: 'Raj Malhotra', initials: 'RM', color: '#2563EB' },
  { id: 'p-jo', name: 'Jo Whitfield', initials: 'JW', color: '#9333EA' },
  { id: 'p-cam', name: 'Cam Reyes', initials: 'CR', color: '#DC2626' },
  { id: 'p-ida', name: 'Ida Solberg', initials: 'IS', color: '#0F766E' },
  { id: 'p-ben', name: 'Ben Okafor', initials: 'BO', color: '#7E22CE' },
]

function take(count: number, offset: number): Player[] {
  return Array.from(
    { length: count },
    (_, index) => PLAYER_POOL[(offset + index) % PLAYER_POOL.length]!,
  )
}

/**
 * Covers every UI state on first load: joinable, full, already joined, hosted
 * by the current user, and empty roster.
 */
export const SEED_GAMES: Game[] = [
  {
    id: 'g-hoops',
    sport: { label: 'Basketball', emoji: '🏀' },
    title: 'Friday Night Hoops at the Rec',
    startAt: '2026-11-06T18:30:00',
    endAt: '2026-11-06T20:30:00',
    location: 'Riverside Recreation Center, 240 Court St',
    skillLevel: 'Beginner',
    language: 'English',
    capacity: 10,
    description:
      'Casual full-court runs, winners stay on. Bring a light and a dark shirt so we can split teams quickly. Water fountains are on the second floor.',
    hostId: 'p-marcus',
    players: take(4, 0),
  },
  {
    id: 'g-soccer',
    sport: { label: 'Soccer', emoji: '⚽' },
    title: 'Saturday 11v11 — Turf Field',
    startAt: '2026-11-07T09:00:00',
    endAt: '2026-11-07T11:00:00',
    location: 'Eastside Sports Complex, Field 3',
    skillLevel: 'Experienced',
    language: 'Spanish',
    capacity: 12,
    description:
      'Competitive pickup with refs for the first half. Cleats required, no metal studs. We start on time, so arrive ten minutes early to warm up.',
    hostId: 'p-sofia',
    players: take(12, 2),
  },
  {
    id: 'g-volleyball',
    sport: { label: 'Volleyball', emoji: '🏐' },
    title: 'Sunday Sand Volleyball',
    startAt: '2026-11-08T15:00:00',
    endAt: '2026-11-08T17:00:00',
    location: 'Harbor Beach Courts, Court 2',
    skillLevel: 'Beginner',
    language: 'English',
    capacity: 12,
    description:
      'Rotating 6v6 on sand. All levels welcome — we mix teams so everyone gets touches. Sunscreen recommended, there is zero shade.',
    hostId: 'p-nina',
    players: [...take(4, 5), CURRENT_USER],
  },
  {
    id: 'g-tennis',
    sport: { label: 'Tennis', emoji: '🎾' },
    title: 'Doubles Drill Session',
    startAt: '2026-11-09T17:00:00',
    endAt: '2026-11-09T19:00:00',
    location: 'Cedar Park Courts, Courts 4–5',
    skillLevel: 'Beginner',
    language: 'English',
    capacity: 4,
    description:
      'Focused on doubles positioning and volleys. I bring a basket of balls. Two courts booked, so we can rotate through drills without waiting.',
    hostId: CURRENT_USER.id,
    players: take(2, 7),
  },
  {
    id: 'g-frisbee',
    sport: { label: 'Frisbee', emoji: '🥏' },
    title: 'Wednesday Ultimate Pickup',
    startAt: '2026-11-11T18:00:00',
    endAt: '2026-11-11T20:00:00',
    location: 'North Meadow, enter at Gate B',
    skillLevel: 'Experienced',
    language: 'English',
    capacity: 8,
    description:
      'Fast-paced ultimate with a stall count. First timers are welcome but expect to learn the stack quickly. Bring a white and a dark shirt.',
    hostId: CURRENT_USER.id,
    players: [],
  },
  {
    id: 'g-pickleball',
    sport: { label: 'Pickleball', emoji: '🏓' },
    title: 'Tuesday Morning Pickleball',
    startAt: '2026-11-10T08:00:00',
    endAt: '2026-11-10T10:00:00',
    location: 'Sunset Community Courts, Court 1',
    skillLevel: 'Experienced',
    language: 'Mandarin',
    capacity: 8,
    description:
      'Doubles rotations, paddle-up style. Bring your own paddle if you have one; I keep three loaners in the bag. Coffee nearby afterwards.',
    hostId: 'p-omar',
    players: take(7, 9),
  },
]
