// Saves Chicago grocery stores and stores that take SNAP (EBT) to public/groceries.json. Part of `npm run snapshot`;
// run it after scripts/snapshot.js, since it reuses the neighborhood shapes saved there.
//  - Grocery: stores the city's health inspectors list as "Grocery Store" (Food Inspections, 4ijn-s7e5),
//             inspected in the last two years and not closed at their latest visit.
//  - SNAP:    USDA's SNAP Retailer Locator, every store currently authorized to take EBT (updated by USDA monthly).
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { areaOf } from './extras.js'
import { FULL_GROCERY } from '../src/score.js'

const INSPECTIONS = 'https://data.cityofchicago.org/resource/4ijn-s7e5.json'
const SNAP = 'https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0'
const CLOSED = new Set(['Out of Business', 'Business Not Located'])
const r5 = (n) => Math.round(n * 1e5) / 1e5

// One entry per licensed store, from its latest inspection; drops stores found closed.
export function groceryStores(rows) {
  const latest = {}
  for (const r of rows) if (!(latest[r.license_]?.inspection_date > r.inspection_date)) latest[r.license_] = r
  return Object.values(latest)
    .filter((r) => !CLOSED.has(r.results) && isFinite(+r.latitude) && +r.latitude)
    .map((r) => ({ name: (r.aka_name || r.dba_name || '').trim(), address: (r.address || '').trim(), zip: r.zip ?? '', lat: r5(+r.latitude), lng: r5(+r.longitude) }))
}

// USDA rows to the same shape; restaurants in the Restaurant Meals Program are not stores.
export function snapStores(attrs) {
  return attrs
    .filter((a) => a.Store_Type !== 'Restaurant Meals Program' && a.Latitude && a.Longitude)
    // Drop USDA store numbers: 'Aldi 62092 62092' becomes 'Aldi'.
    .map((a) => ({ name: a.Store_Name.replace(/(\s+#?\d+)+\s*$/, '').trim(), address: a.Store_Street_Address.trim(), zip: a.Zip_Code ?? '', lat: r5(a.Latitude), lng: r5(a.Longitude), type: a.Store_Type }))
}

async function getJson(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) }).catch(() => null)
    if (res?.ok) return res.json()
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`kept failing: ${url}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { geo } = JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url)))
  const since = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10) + 'T00:00:00'

  const inspections = await getJson(`${INSPECTIONS}?` + new URLSearchParams({
    $limit: 50000, $select: 'license_, dba_name, aka_name, address, zip, latitude, longitude, results, inspection_date',
    $where: `upper(facility_type) = 'GROCERY STORE' AND inspection_date > '${since}'`,
  }))
  // Cook County, then keep what falls inside a Chicago neighborhood (USDA spells city names many ways).
  const attrs = []
  for (let offset = 0; ; offset += 1000) {
    const page = await getJson(`${SNAP}/query?` + new URLSearchParams({
      where: "State = 'IL' AND County = 'COOK'", outFields: 'Store_Name,Store_Street_Address,Zip_Code,Store_Type,Latitude,Longitude',
      returnGeometry: false, orderByFields: 'ObjectId', resultOffset: offset, resultRecordCount: 1000, f: 'json',
    }))
    if (page.error) throw new Error(`USDA: ${page.error.message}`)
    attrs.push(...page.features.map((f) => f.attributes))
    if (!page.exceededTransferLimit) break
  }
  const layer = await getJson(`${SNAP}?f=json`)

  const areas = {}
  for (const f of geo.features) areas[f.properties.area_numbe] = { grocery: 0, snap: 0, snapGrocery: 0 }
  const place = (s) => (s.area = areaOf(geo.features, s.lng, s.lat))
  const grocery = groceryStores(inspections).filter(place)
  const snap = snapStores(attrs).filter(place)
  for (const s of grocery) areas[s.area].grocery++
  for (const s of snap) { areas[s.area].snap++; if (FULL_GROCERY.has(s.type)) areas[s.area].snapGrocery++ }

  if (grocery.length < 500 || snap.length < 1000) throw new Error(`too little data (${grocery.length} grocery, ${snap.length} SNAP); not saving`)
  const out = {
    savedAt: new Date().toISOString(),
    snapUpdated: new Date(layer.editingInfo.dataLastEditDate).toISOString(),
    areas,
    grocery: grocery.map(({ area, ...s }) => s),
    snap: snap.map(({ area, ...s }) => s),
  }
  writeFileSync(new URL('../public/groceries.json', import.meta.url), JSON.stringify(out))
  console.log(`saved ${grocery.length} grocery stores (from ${inspections.length} inspections) and ${snap.length} SNAP stores (of ${attrs.length} in Cook County, USDA updated ${out.snapUpdated.slice(0, 10)})`)
}
