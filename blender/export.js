// Turns the app's saved data into skyline-data.json for skyline.py, using the app's own equity() math.
// Run: node blender/export.js   (after `npm run snapshot` for fresh numbers)
import { readFileSync, writeFileSync } from 'node:fs'
import { equity } from '../src/score.js'

const snap = JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url)))
const e = equity(snap.byAreaType, snap.lowIncome)
const index = Object.fromEntries(e.areas.map((a) => [a.id, a.index]))

// Flat km grid centered on the city: plenty accurate at Chicago's size.
const LAT0 = 41.84, LNG0 = -87.68
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180), KY = 110.574
const toKm = ([lng, lat]) => [+((lng - LNG0) * KX).toFixed(3), +((lat - LAT0) * KY).toFixed(3)]

const areas = snap.geo.features.map(({ properties: p, geometry: g }) => {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return {
    id: p.area_numbe,
    name: p.community,
    index: index[p.area_numbe] ?? null,
    // shortcut: outer rings only, holes dropped; no Chicago community area has a visible hole at this scale.
    rings: polys.map((poly) => poly[0].slice(0, -1).map(toKm)),
  }
})

const out = new URL('./skyline-data.json', import.meta.url)
writeFileSync(out, JSON.stringify({ savedAt: snap.savedAt, rich: e.rich, poor: e.poor, areas }))
const known = areas.filter((a) => a.index != null)
console.log(`wrote ${areas.length} areas (${known.length} with a wait index), ${areas.reduce((s, a) => s + a.rings.reduce((t, r) => t + r.length, 0), 0)} vertices`)
