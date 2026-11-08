/**
 * Two-letter initials from a name, e.g. "Jane Doe" -> "JD"
 * Used for avatar chips, which stand in for real profile images.
 */
export function initialsOf(name: string): string {
  const cleaned = name.trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return cleaned.slice(0, 2).toUpperCase()
}

/**
 * Stable colour per user so the same person keeps the same tint across cards
 * and the detail view. No image assets and no server field needed.
 */
const AVATAR_COLORS = [
  '#0284C7',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#059669',
  '#4F46E5',
  '#C026D3',
  '#0D9488',
  '#B45309',
  '#2563EB',
]

export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_003
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}
