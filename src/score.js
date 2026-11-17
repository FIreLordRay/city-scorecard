import { rollup } from './data.js'

// Pure scoring logic, kept apart from React so it can be tested.

// Share of other values strictly below v, 0..1.
export function pctRank(values, v) {
  if (values.length < 2) return 0.5
  return values.filter((x) => x < v).length / (values.length - 1)
}

export function rateServices(types, minRequests = 100) {
  const rows = types.filter((t) => t.n >= minRequests && t.days != null)
  const opens = rows.map((t) => t.open / t.n)
  const days = rows.map((t) => t.days)
  return rows
    .map((t) => {
      const score = (2 - pctRank(opens, t.open / t.n) - pctRank(days, t.days)) / 2
      return { ...t, score, stars: 1 + Math.round(score * 4) }
    })
    .sort((a, b) => b.score - a.score)
}

const R = 6371
export function km([lat1, lng1], [lat2, lng2]) {
  const rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// shortcut: mean of the largest ring's vertices, not a true centroid; fine for compact community areas.
export function centroid(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const ring = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0]
  const [lng, lat] = ring.reduce(([x, y], [a, b]) => [x + a, y + b], [0, 0])
  return [lat / ring.length, lng / ring.length]
}

export function gradeOf(score) {
  return score >= 0.8 ? 'A' : score >= 0.6 ? 'B' : score >= 0.4 ? 'C' : score >= 0.2 ? 'D' : 'F'
}

export function scoreAreas({ geo, areas, clinics, pop }) {
  const rows = geo.features.map((f) => {
    const { area_numbe: id, community: name } = f.properties
    const s = areas[id] ?? { n: 0, open: 0, days: null }
    const c = centroid(f.geometry)
    const nearest = clinics.reduce((best, k) => {
      const d = km(c, [k.lat, k.lng])
      return d < best.d ? { d, clinic: k } : best
    }, { d: Infinity, clinic: null })
    return {
      id, name, feature: f,
      requests: s.n,
      perK: pop[name] ? (s.n / pop[name]) * 1000 : null,
      openShare: s.n ? s.open / s.n : 0,
      // No closed requests ranks as slowest, not fastest.
      days: s.days ?? Infinity,
      clinicKm: nearest.d,
      nearestClinic: nearest.clinic,
    }
  })
  // Lower is better on all three graded measures.
  const cols = ['openShare', 'days', 'clinicKm']
  const all = Object.fromEntries(cols.map((k) => [k, rows.map((r) => r[k])]))
  return rows
    .map((r) => {
      const score = cols.reduce((sum, k) => sum + 1 - pctRank(all[k], r[k]), 0) / cols.length
      return { ...r, score, grade: gradeOf(score) }
    })
    .sort((a, b) => b.score - a.score)
}

export const title = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
export const fmt = (n, d = 0) => (n == null || !isFinite(n) ? '–' : n.toLocaleString(undefined, { maximumFractionDigits: d }))
export const pct = (x) => `${Math.round(x * 100)}%`

const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
const fifths = (xs) => {
  const s = [...xs].sort((a, b) => a.low - b.low)
  const k = Math.max(1, Math.floor(s.length / 5))
  return [s.slice(0, k), s.slice(-k)]
}

// Does the same request take longer in lower-income areas? Each area is compared with the
// city average for its own mix of requests, so it isn't judged on what kinds of requests it files.
export function equity(byAreaType, lowById) {
  const rows = byAreaType.filter((r) => r.days != null && r.n > r.open && lowById[r.community_area] != null)
  const city = Object.fromEntries(rollup(rows, 'sr_type').map((t) => [t.sr_type, t.days]))
  // Same-day services carry no wait signal.
  const timed = rows.filter((r) => city[r.sr_type] >= 0.5)
  const sums = {}
  for (const r of timed) {
    const s = (sums[r.community_area] ??= [0, 0])
    s[0] += (r.n - r.open) * r.days
    s[1] += (r.n - r.open) * city[r.sr_type]
  }
  const areas = Object.entries(sums).map(([id, [actual, expected]]) => ({ id, low: lowById[id], index: actual / expected }))
  const [rich, poor] = fifths(areas)
  // 30+ closed requests per area: with fewer, one slow ticket swings an area's average (yard waste went 5.8x -> 4x).
  const services = Object.entries(Object.groupBy(timed.filter((r) => r.n - r.open >= 30), (r) => r.sr_type))
    .filter(([, rs]) => rs.length >= 25)
    .map(([type, rs]) => {
      const [r, p] = fifths(rs.map((x) => ({ low: lowById[x.community_area], days: x.days })))
      return { type, rich: avg(r.map((x) => x.days)), poor: avg(p.map((x) => x.days)) }
    })
    .sort((a, b) => b.poor / b.rich - a.poor / a.rich)
  return { areas, rich: avg(rich.map((a) => a.index)), poor: avg(poor.map((a) => a.index)), services }
}
// Is [lng, lat] inside this GeoJSON Polygon or MultiPolygon? Even-odd ray cast over every ring, so holes count as outside.
export function contains(geometry, [x, y]) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let inside = false
  for (const ring of polys.flat()) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

// USDA SNAP store types that sell a full range of groceries, as opposed to corner, specialty or restaurant.
export const FULL_GROCERY = new Set(['Supermarket', 'Super Store', 'Grocery Store', 'Farmers and Markets'])
