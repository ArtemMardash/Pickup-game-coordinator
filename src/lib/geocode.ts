/**
 * Geocoding + place autocomplete (MAP FEATURE: new file).
 *
 *  - geocodeText():        free text  -> coordinates (Geocoding API)
 *  - fetchSuggestions():   typing     -> suggestions (Places Autocomplete)
 *  - resolveSuggestion():  suggestion -> coordinates (Places Details)
 *  - coordinatesForPost(): the one call App.tsx makes when a post is saved
 *
 * Posts are geocoded once, when saved (plan, "Key Decisions" #2), so browsing
 * never calls the Geocoding API. Nothing here reads the user's live location.
 */
import { loadGeocodingLibrary, loadPlacesLibrary, mapsConfigured } from './googleMaps'

export interface GeoBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface GeoResult {
  lat: number
  lng: number
  label: string
  /** Suggested viewport for the place (a city is big, an address is small). */
  bounds: GeoBounds | null
}

export interface PlaceSuggestion {
  id: string
  /** Full text, e.g. "Central Park, New York, NY, USA". */
  text: string
  main: string
  secondary: string
  prediction: google.maps.places.PlacePrediction
}

export async function geocodeText(text: string): Promise<GeoResult | null> {
  const address = text.trim()
  if (!address) return null
  const { Geocoder } = await loadGeocodingLibrary()
  try {
    const { results } = await new Geocoder().geocode({ address })
    const first = results[0]
    if (!first) return null
    return {
      lat: first.geometry.location.lat(),
      lng: first.geometry.location.lng(),
      label: first.formatted_address || address,
      bounds: first.geometry.viewport ? first.geometry.viewport.toJSON() : null,
    }
  } catch (cause) {
    // Newer API versions reject with ZERO_RESULTS instead of returning [].
    const code = (cause as { code?: string } | null)?.code
    if (code === 'ZERO_RESULTS') return null
    throw cause
  }
}

let sessionToken: google.maps.places.AutocompleteSessionToken | null = null

export async function fetchSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const text = input.trim()
  if (text.length < 2) return []
  const { AutocompleteSuggestion, AutocompleteSessionToken } = await loadPlacesLibrary()
  sessionToken ??= new AutocompleteSessionToken()
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: text,
    sessionToken,
  })
  const out: PlaceSuggestion[] = []
  for (const suggestion of suggestions) {
    const prediction = suggestion.placePrediction
    if (!prediction) continue
    out.push({
      id: prediction.placeId,
      text: prediction.text.text,
      main: prediction.mainText?.text ?? prediction.text.text,
      secondary: prediction.secondaryText?.text ?? '',
      prediction,
    })
  }
  return out
}

export async function resolveSuggestion(suggestion: PlaceSuggestion): Promise<GeoResult | null> {
  const place = suggestion.prediction.toPlace()
  await place.fetchFields({ fields: ['location', 'viewport', 'formattedAddress'] })
  sessionToken = null // a session ends once its place is fetched
  if (!place.location) return null
  return {
    lat: place.location.lat(),
    lng: place.location.lng(),
    label: place.formattedAddress || suggestion.text,
    bounds: place.viewport ? place.viewport.toJSON() : null,
  }
}

interface ExistingPostLocation {
  location: string
  latitude: number | null
  longitude: number | null
}

/**
 * Coordinates to send with a create/edit request.
 *
 * Needed on EDIT too: the backend clears a game's coordinates whenever
 * `location` is sent without new ones, so an edit that only changed the title
 * would otherwise drop the game's pin.
 *
 * Never throws and never blocks saving: if the address can't be found (or no
 * API key is set) the post is still saved, just without a map pin.
 */
export async function coordinatesForPost(
  location: string,
  existing?: ExistingPostLocation | null,
): Promise<{ latitude?: number; longitude?: number }> {
  const text = location.trim()
  if (
    existing &&
    existing.location.trim() === text &&
    existing.latitude !== null &&
    existing.longitude !== null
  ) {
    return { latitude: existing.latitude, longitude: existing.longitude }
  }
  if (!mapsConfigured() || !text) return {}
  try {
    const found = await geocodeText(text)
    return found ? { latitude: found.lat, longitude: found.lng } : {}
  } catch {
    return {}
  }
}
