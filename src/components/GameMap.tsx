import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LocationFilter } from '../lib/filters'
import type { GeoResult } from '../lib/geocode'
import { loadMapLibraries, onMapsAuthFailure, MAP_ID } from '../lib/googleMaps'
import { groupIsFull, milesToKm } from '../lib/mapGames'
import type { PinGroup } from '../lib/mapGames'
import { sportEmoji } from '../lib/sport'
import type { AreaSearchEvent } from './AreaSearch'
import { MapGamePreview } from './MapGamePreview'
import styles from './GameMap.module.css'

/**
 * MAP FEATURE (new file). The Google Map itself: pins (F7), pin previews (F8),
 * moving to a searched area (F9), the distance-filter circle (S10.3) and the
 * empty states. It is a dumb view over `groups`: filtering and sorting are
 * done by the server, so the pins always match the list (S10.5).
 *
 * The same instance serves the compact panel and the expanded view; MapView
 * only changes the wrapper's CSS, so the map is created (and billed) once.
 */
interface GameMapProps {
  groups: PinGroup[]
  gamesLoading: boolean
  expanded: boolean
  area: AreaSearchEvent | null
  radius: LocationFilter | null
  filtersActive: boolean
  onClearFilters: () => void
  selected: PinGroup | null
  onSelectKey: (key: string | null) => void
  onOpenGame: (gameId: number) => void
  /** Rendered on top of the map (the expand/collapse button). */
  children?: ReactNode
}

type Phase = 'loading' | 'ready' | 'error'

const MAX_AREA_ZOOM = 15
const FIT_PADDING = 48

function buildPin(group: PinGroup): HTMLButtonElement {
  const first = group.games[0]
  const sameSport = group.games.every((g) => g.game_name === first.game_name)
  const full = groupIsFull(group)

  const el = document.createElement('button')
  el.type = 'button'
  el.className = `${styles.pin} ${full ? styles.pinFull : ''}`
  el.setAttribute(
    'aria-label',
    group.games.length === 1
      ? `${first.game_name}: ${first.title}${full ? ' (full)' : ''}`
      : `${group.games.length} games at this location`,
  )

  const emoji = document.createElement('span')
  emoji.className = styles.pinEmoji
  emoji.textContent = sameSport ? sportEmoji(first.game_name) : '📍'
  el.append(emoji)

  if (group.games.length > 1) {
    const badge = document.createElement('span')
    badge.className = styles.pinCount
    badge.textContent = String(group.games.length)
    el.append(badge)
  }
  // S7.2: a full game is visibly marked on the map.
  if (full) {
    const tag = document.createElement('span')
    tag.className = styles.pinTag
    tag.textContent = 'Full'
    el.append(tag)
  }
  return el
}

export function GameMap({
  groups,
  gamesLoading,
  expanded,
  area,
  radius,
  filtersActive,
  onClearFilters,
  selected,
  onSelectKey,
  onOpenGame,
  children,
}: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  const markersRef = useRef(
    new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; el: HTMLElement }>(),
  )
  const libsRef = useRef<Awaited<ReturnType<typeof loadMapLibraries>> | null>(null)
  const didInitialFit = useRef(false)

  // Latest props for listeners that are created once.
  const groupsRef = useRef(groups)
  const selectKeyRef = useRef(onSelectKey)
  useEffect(() => {
    groupsRef.current = groups
    selectKeyRef.current = onSelectKey
  })

  const [phase, setPhase] = useState<Phase>('loading')
  const [errorText, setErrorText] = useState('')
  const [noneInView, setNoneInView] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  /** S7.1: is any pin inside the visible map area? */
  const updateVisible = useCallback(() => {
    const bounds = mapRef.current?.getBounds()
    if (!bounds) return
    setNoneInView(!groupsRef.current.some((g) => bounds.contains({ lat: g.lat, lng: g.lng })))
  }, [])

  const fitBounds = useCallback((bounds: google.maps.LatLngBoundsLiteral | google.maps.LatLngBounds) => {
    mapRef.current?.fitBounds(bounds, FIT_PADDING)
  }, [])

  const fitAll = useCallback(() => {
    const map = mapRef.current
    const libs = libsRef.current
    const current = groupsRef.current
    if (!map || !libs || current.length === 0) return
    if (current.length === 1) {
      map.setCenter({ lat: current[0].lat, lng: current[0].lng })
      map.setZoom(14)
      return
    }
    const bounds = new libs.core.LatLngBounds()
    current.forEach((g) => bounds.extend({ lat: g.lat, lng: g.lng }))
    map.fitBounds(bounds, FIT_PADDING)
  }, [])

  // --- Create the map once --------------------------------------------------
  useEffect(() => {
    let cancelled = false
    let observer: ResizeObserver | null = null

    loadMapLibraries()
      .then((libs) => {
        const container = containerRef.current
        if (cancelled || !container || mapRef.current) return
        libsRef.current = libs
        const map = new libs.maps.Map(container, {
          mapId: MAP_ID, // required for AdvancedMarkerElement
          center: { lat: 39.5, lng: -98.35 }, // whole-US view until pins arrive
          zoom: 4,
          minZoom: 2,
          gestureHandling: 'cooperative',
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false, // we provide our own expand button
          clickableIcons: false, // keep Google's POI popups out of our preview
        })
        mapRef.current = map

        // Tapping an empty part of the map closes the preview (S8.1).
        map.addListener('click', () => selectKeyRef.current(null))
        map.addListener('idle', updateVisible)

        // Expanding changes the container size without a window resize.
        observer = new ResizeObserver(() => {
          const center = map.getCenter()
          google.maps.event.trigger(map, 'resize')
          if (center) map.setCenter(center)
        })
        observer.observe(container)

        setPhase('ready')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setErrorText(cause instanceof Error ? cause.message : 'Could not load the map')
        setPhase('error')
      })

    const offAuth = onMapsAuthFailure(() => {
      setErrorText(
        'Google rejected the Maps API key. Check that the key is valid, the Maps JavaScript API is enabled, and this site is allowed by the key’s referrer restrictions.',
      )
      setPhase('error')
    })

    return () => {
      cancelled = true
      observer?.disconnect()
      offAuth()
    }
  }, [updateVisible])

  // --- Pins (F7, S7.2) ------------------------------------------------------
  // Rebuilt whenever the games change: new posts appear, edited locations move,
  // deleted/ended posts disappear and a game that fills up turns "Full".
  useEffect(() => {
    const map = mapRef.current
    const libs = libsRef.current
    if (phase !== 'ready' || !map || !libs) return

    markersRef.current.forEach(({ marker }) => {
      marker.map = null
    })
    markersRef.current.clear()

    for (const group of groups) {
      const el = buildPin(group)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        selectKeyRef.current(group.key)
      })
      const marker = new libs.marker.AdvancedMarkerElement({
        map,
        position: { lat: group.lat, lng: group.lng },
        content: el,
      })
      markersRef.current.set(group.key, { marker, el })
    }
    updateVisible()
  }, [phase, groups, updateVisible])

  // Highlight the selected pin and bring it forward (runs after the rebuild).
  const selectedKey = selected?.key ?? null
  useEffect(() => {
    markersRef.current.forEach(({ marker, el }, key) => {
      const on = key === selectedKey
      el.classList.toggle(styles.pinSelected, on)
      marker.zIndex = on ? 1000 : null
    })
  }, [phase, groups, selectedKey])

  // Keep the selected pin on screen (the preview card covers the map bottom).
  const selectedLat = selected?.lat
  const selectedLng = selected?.lng
  useEffect(() => {
    if (phase !== 'ready' || selectedLat === undefined || selectedLng === undefined) return
    mapRef.current?.panTo({ lat: selectedLat, lng: selectedLng })
  }, [phase, selectedKey, selectedLat, selectedLng])

  // --- First view: frame all pins once, when the first games arrive --------
  useEffect(() => {
    if (phase !== 'ready' || didInitialFit.current || groups.length === 0) return
    didInitialFit.current = true
    fitAll()
  }, [phase, groups, fitAll])

  // --- Area search (F9, S9.1) ----------------------------------------------
  useEffect(() => {
    if (phase !== 'ready' || !area) return
    if (area.error) {
      setToast(area.error)
    } else if (!area.result) {
      setToast('Location not found') // the map stays where it was
    } else {
      setToast(null)
      const found: GeoResult = area.result
      const map = mapRef.current
      if (!map) return
      if (found.bounds) {
        fitBounds(found.bounds)
        // A street address has a tiny viewport; don't zoom in absurdly far.
        google.maps.event.addListenerOnce(map, 'idle', () => {
          if ((map.getZoom() ?? 0) > MAX_AREA_ZOOM) map.setZoom(MAX_AREA_ZOOM)
        })
      } else {
        map.setCenter({ lat: found.lat, lng: found.lng })
        map.setZoom(13)
      }
    }
  }, [phase, area, fitBounds])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  // --- Distance filter circle (S10.3) --------------------------------------
  useEffect(() => {
    const map = mapRef.current
    const libs = libsRef.current
    if (phase !== 'ready' || !map || !libs) return
    circleRef.current?.setMap(null)
    circleRef.current = null
    if (!radius) return
    const circle = new libs.maps.Circle({
      map,
      center: { lat: radius.lat, lng: radius.lng },
      radius: milesToKm(radius.miles) * 1000,
      strokeColor: '#0284c7',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#38bdf8',
      fillOpacity: 0.08,
      clickable: false,
    })
    circleRef.current = circle
    const bounds = circle.getBounds()
    if (bounds) fitBounds(bounds)
  }, [phase, radius, fitBounds])

  // Wheel-zoom freely when expanded; require Ctrl/⌘ in the scrolling page.
  useEffect(() => {
    if (phase !== 'ready') return
    mapRef.current?.setOptions({ gestureHandling: expanded ? 'greedy' : 'cooperative' })
  }, [phase, expanded])

  // --- Empty states (S7.1, S9.1, S10.5) ------------------------------------
  const showEmpty = phase === 'ready' && !gamesLoading && noneInView
  const noMatches = groups.length === 0 && filtersActive

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.canvas} />

      {phase === 'loading' && <div className={styles.status}>Loading map…</div>}
      {phase === 'error' && (
        <div className={styles.status} role="alert">
          {errorText}
        </div>
      )}

      <div className={styles.notices}>
        {toast && (
          <div className={styles.notice} role="status">
            {toast}
          </div>
        )}
        {showEmpty && (
          <div className={styles.notice} role="status">
            {noMatches ? 'No games match your filters' : 'No games in this area'}
            {noMatches && (
              <button type="button" className={styles.noticeAction} onClick={onClearFilters}>
                Clear filters
              </button>
            )}
            {!noMatches && groups.length > 0 && (
              <button type="button" className={styles.noticeAction} onClick={fitAll}>
                Show all games
              </button>
            )}
          </div>
        )}
      </div>

      {selected && (
        <MapGamePreview
          group={selected}
          onClose={() => onSelectKey(null)}
          onOpenGame={onOpenGame}
        />
      )}

      {children}
    </div>
  )
}
