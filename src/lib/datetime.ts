/**
 * Conversions between `<input type="datetime-local">` values and the ISO 8601
 * strings the API requires.
 *
 * A datetime-local input yields "2026-11-08T18:30" — a wall-clock time with no
 * offset. Posting that raw is rejected with a 422, so it must go through a Date
 * (parsed as local) and out as `toISOString()` (UTC with a Z suffix).
 */

/** ISO 8601 (with offset) -> value for a datetime-local input, in local time. */
export function isoToLocalInput(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** datetime-local value -> ISO 8601 with the browser's offset. */
export function localInputToIso(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

/** Default end time for a new game: one hour after the given start. */
export function plusHoursLocalInput(value: string, hours: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setHours(date.getHours() + hours)
  return isoToLocalInput(date.toISOString())
}
