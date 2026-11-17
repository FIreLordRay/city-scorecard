import { contains } from './score.js'

const SEARCH = 'https://nominatim.openstreetmap.org/search'
const BOX = '-87.94,42.03,-87.52,41.64'   // Chicago's bounding box, so "Main St" finds the Chicago one

// Typed address -> { area, point } in Chicago, or null when it isn't one. Throws when the search is unreachable.
// The point stays in memory only, so the URL and anything shared from it name the neighborhood, never the address.
export async function lookupAddress(areas, text) {
  const params = new URLSearchParams({ q: `${text}, Chicago, IL`, format: 'jsonv2', limit: 1, viewbox: BOX, bounded: 1 })
  const res = await fetch(`${SEARCH}?${params}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`address search failed (HTTP ${res.status})`)
  const [hit] = await res.json()
  const point = hit && [+hit.lon, +hit.lat]
  const area = point && areas.find((a) => contains(a.feature.geometry, point))
  return area ? { area, point } : null
}
