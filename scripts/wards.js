// Saves the 50 ward shapes and each ward's alderman office to public/wards.json, so "Your block" can
// find a ward instantly and offline. Boundaries change once a decade, offices rarely. Part of `npm run snapshot`.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const B = 'https://data.cityofchicago.org/resource'

// The portal answers "Service unavailable" about half the time on these datasets, so retry.
async function get(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) }).catch(() => null)
    if (res?.ok) return res.json()
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`Chicago Data Portal kept failing: ${url}`)
}

// "La Spata, Daniel" -> "Daniel La Spata"
export const displayName = (s = '') => s.includes(',') ? s.split(',').map((x) => x.trim()).reverse().join(' ') : s.trim()

// shortcut: simplified to about 20 m (3.5 MB -> 69 KB); an address within ~20 m of a ward line can land in the neighbor ward.
const SIMPLIFY = 0.0002
const round = (g) => JSON.parse(JSON.stringify(g, (k, v) => (typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v)))

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [shapes, offices] = await Promise.all([
    get(`${B}/p293-wvbd.geojson?` + new URLSearchParams({ $select: `ward, simplify_preserve_topology(the_geom, ${SIMPLIFY}) as the_geom`, $limit: 100 })),
    get(`${B}/htai-wnw4.json?$limit=100`),
  ])
  const office = Object.fromEntries(offices.map((o) => [o.ward, {
    alderman: displayName(o.alderman), phone: o.ward_phone, email: o.email, website: o.website?.url ?? null,
    address: o.address,
  }]))
  const list = shapes.features
    .map((f) => ({ ward: f.properties.ward, geometry: round(f.geometry), ...office[f.properties.ward] }))
    .sort((a, b) => a.ward - b.ward)
  if (list.length !== 50) throw new Error(`expected 50 wards, got ${list.length}`)
  writeFileSync(new URL('../public/wards.json', import.meta.url), JSON.stringify({ savedAt: new Date().toISOString(), list }))
  console.log(`saved ${list.length} wards (${list.filter((w) => w.alderman).length} with an alderman office) to public/wards.json`)
}
