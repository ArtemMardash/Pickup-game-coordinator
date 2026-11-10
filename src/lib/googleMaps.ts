/// <reference types="google.maps" />
/**
 * Google Maps loader (MAP FEATURE: new file).
 *
 * Loads the Maps JavaScript API once, on demand, with a plain <script> tag so
 * no extra npm runtime dependency is needed. Libraries (maps, marker, places,
 * geocoding, core) are then pulled in with `google.maps.importLibrary`.
 *
 * Requires VITE_GOOGLE_MAPS_API_KEY (see .env.example). Without it the app
 * still works: the map shows a placeholder and posts are saved without pins.
 */

declare global {
  interface Window {
    __pugMapsReady?: () => void
    gm_authFailure?: () => void
  }
}

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim()

/** Map ID for AdvancedMarkerElement. 'DEMO_MAP_ID' works for development. */
export const MAP_ID =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined)?.trim() || 'DEMO_MAP_ID'

export function mapsConfigured(): boolean {
  return Boolean(API_KEY)
}

let loadPromise: Promise<void> | null = null

// Google calls window.gm_authFailure when the key is rejected (wrong key,
// API not enabled, referrer not allowed). Surface it instead of a blank map.
let authFailed = false
const authListeners = new Set<() => void>()

export function onMapsAuthFailure(listener: () => void): () => void {
  if (authFailed) listener()
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

export function loadGoogleMaps(): Promise<void> {
  if (!API_KEY) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'))
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    window.gm_authFailure = () => {
      authFailed = true
      authListeners.forEach((listener) => listener())
    }
    window.__pugMapsReady = () => resolve()

    const params = new URLSearchParams({
      key: API_KEY,
      v: 'weekly',
      loading: 'async',
      callback: '__pugMapsReady',
    })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onerror = () => {
      loadPromise = null // allow a retry (e.g. after going back online)
      reject(new Error('Could not load Google Maps'))
    }
    document.head.append(script)
  })
  return loadPromise
}

export async function loadMapLibraries() {
  await loadGoogleMaps()
  const [maps, marker, core] = await Promise.all([
    google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
    google.maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
    google.maps.importLibrary('core') as Promise<google.maps.CoreLibrary>,
  ])
  return { maps, marker, core }
}

export async function loadPlacesLibrary() {
  await loadGoogleMaps()
  return (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary
}

export async function loadGeocodingLibrary() {
  await loadGoogleMaps()
  return (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary
}
