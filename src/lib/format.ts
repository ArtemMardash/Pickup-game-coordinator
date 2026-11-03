const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso))
}

export function formatTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso))
}

export function formatStart(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`
}

/** Full label for the detail view: a start–end range, collapsing a shared date. */
export function formatRange(startAt: string, endAt: string): string {
  const sameDay = formatDate(startAt) === formatDate(endAt)
  const timeSpan = `${formatTime(startAt)} – ${formatTime(endAt)}`
  return sameDay
    ? `${formatDate(startAt)} · ${timeSpan}`
    : `${formatStart(startAt)} – ${formatDate(endAt)} · ${formatTime(endAt)}`
}
