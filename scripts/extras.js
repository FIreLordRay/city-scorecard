// Saves per-neighborhood safety, transit, housing and food data to public/extras.json. Part of `npm run snapshot`;
// run it after scripts/snapshot.js, since it reuses the neighborhood shapes saved there.
//  - Safety:  reported crimes and how many led to an arrest (Crimes 2001 to Present, ijzp-q8t2)
//  - Transit: every 'L' station and Divvy dock, so the app can find the closest to any address (8pix-ypme, bbyy-e7gq)
//  - Housing: building code violations (22u3-xenr) and affordable rental units (s6ha-ppgi)
//  - Food:    restaurant inspection results (4ijn-s7e5)
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { contains } from '../src/score.js'
import { DAYS } from '../src/data.js'

const B = 'https://data.cityofchicago.org/resource'

// The portal answers "Service unavailable" often, so retry.
async function get(id, params) {
  const url = `${B}/${id}.json?` + new URLSearchParams({ $limit: 50000, ...params })
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) }).catch(() => null)
    if (res?.ok) return res.json()
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`Chicago Data Portal kept failing: ${url}`)
}

// Food and building data carry only a lat/lng, so place each point in its neighborhood.
export function areaOf(features, lng, lat) {
  if (!isFinite(lng) || !isFinite(lat)) return null
  return features.find((f) => contains(f.geometry, [lng, lat]))?.properties.area_numbe ?? null
}

// Inspections that ended in a verdict; "No Entry", "Not Ready" and "Out of Business" say nothing about the food.
export const VERDICTS = new Set(['Pass', 'Pass w/ Conditions', 'Fail'])

const LINES = { red: 'Red', blue: 'Blue', g: 'Green', brn: 'Brown', p: 'Purple', y: 'Yellow', pnk: 'Pink', o: 'Orange' }
const r5 = (n) => Math.round(n * 1e5) / 1e5

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { geo } = JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url)))
  const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10) + 'T00:00:00'

  const [crimes, food, violations, housing, stops, docks] = await Promise.all([
    get('ijzp-q8t2', { $select: 'community_area, arrest, count(*) as n', $where: `date > '${since}'`, $group: 'community_area, arrest' }),
    get('4ijn-s7e5', { $select: 'results, latitude, longitude', $where: `inspection_date > '${since}'` }),
    get('22u3-xenr', {
      $select: "address, latitude, longitude, count(*) as n, sum(case(violation_status = 'OPEN', 1, true, 0)) as open",
      $where: `violation_date > '${since}'`, $group: 'address, latitude, longitude',
    }),
    get('s6ha-ppgi', { $select: 'community_area_number, sum(units) as units', $group: 'community_area_number' }),
    get('8pix-ypme', {}),
    get('bbyy-e7gq', { $select: 'latitude, longitude, status' }),
  ])

  const areas = {}
  const at = (id) => (areas[id] ??= { crimes: 0, arrests: 0, inspections: 0, fails: 0, violations: 0, openViolations: 0, buildings: 0, affordableUnits: 0 })
  for (const f of geo.features) at(f.properties.area_numbe)

  for (const c of crimes) {
    if (!areas[c.community_area]) continue // rows with no or an old-style area number
    at(c.community_area).crimes += +c.n
    if (c.arrest === true || c.arrest === 'true') at(c.community_area).arrests += +c.n
  }
  for (const f of food) {
    if (!VERDICTS.has(f.results)) continue
    const id = areaOf(geo.features, +f.longitude, +f.latitude)
    if (!id) continue
    at(id).inspections++
    if (f.results === 'Fail') at(id).fails++
  }
  for (const v of violations) {
    const id = areaOf(geo.features, +v.longitude, +v.latitude)
    if (!id) continue
    at(id).violations += +v.n
    at(id).openViolations += +v.open
    at(id).buildings++
  }
  for (const h of housing) if (areas[h.community_area_number]) at(h.community_area_number).affordableUnits = Math.round(+h.units)

  // One entry per station (the list has a row per platform direction).
  const stations = {}
  for (const s of stops) {
    const [lng, lat] = s.location?.coordinates ?? [+s.location?.longitude, +s.location?.latitude]
    const st = (stations[s.map_id] ??= { name: s.station_name, lat: r5(+lat), lng: r5(+lng), ada: false, lines: new Set() })
    st.ada ||= s.ada === true || s.ada === 'true'
    for (const [k, name] of Object.entries(LINES)) if (s[k] === true || s[k] === 'true') st.lines.add(name)
  }
  const lStations = Object.values(stations).map((s) => ({ ...s, lines: [...s.lines] })).filter((s) => isFinite(s.lat))
  const divvy = docks.filter((d) => d.status !== 'Not In Service' && d.latitude).map((d) => [r5(+d.latitude), r5(+d.longitude)])

  const sum = (k) => Object.values(areas).reduce((s, a) => s + a[k], 0)
  const city = { arrestShare: sum('arrests') / sum('crimes'), failShare: sum('fails') / sum('inspections') }
  if (lStations.length < 100 || divvy.length < 500 || sum('crimes') < 1000) throw new Error('portal returned too little data; not saving')

  writeFileSync(new URL('../public/extras.json', import.meta.url), JSON.stringify({ savedAt: new Date().toISOString(), days: DAYS, city, areas, lStations, divvy }))
  console.log(`saved extras: ${sum('crimes')} crimes, ${sum('inspections')} inspections, ${sum('violations')} violations, ${lStations.length} L stations, ${divvy.length} Divvy docks`)
}
