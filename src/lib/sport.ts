import { SPORTS } from '../types'

const SPORTS_BY_LABEL = new Map(SPORTS.map((s) => [s.label.toLowerCase(), s]))

/**
 * Emoji for a sport name. Sports created through the API need not be in the
 * curated catalogue, so this falls back to a neutral glyph.
 */
export function sportEmoji(name: string): string {
  return SPORTS_BY_LABEL.get(name.trim().toLowerCase())?.emoji ?? '🏅'
}
