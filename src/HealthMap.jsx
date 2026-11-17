import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet'
import { title, centroid, km, fmt, pct } from './score.js'
import { lazy, Suspense } from 'react'
import { CITY_311_URL, feedbackUrl } from './config.js'

// three.js is large, so it only downloads when someone opens the 3D view.
const Health3D = lazy(() => import('./Health3D.jsx'))

// Gold (close) to deep rose (far): lightness falls steadily so the order reads without the legend.
const BINS = [[2, '#f3db91'], [4, '#d7b27f'], [6, '#bf8e70'], [8, '#ae7465'], [Infinity, '#785a48']]
const color = (d) => BINS.find(([max]) => d < max)[1]
export const KINDS = { center: ['Community health center', '#5eead4'], city: ['City health clinic', '#f7f2e4'] }
// Google Maps directions URL; with no origin it starts from the visitor's current location.
export const directions = (p) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.address}, Chicago, IL ${p.zip}`.trim())}`

// One shape for both sources so the map popups, the list and the neighborhood report render the same way.
export const buildPlaces = (centers, clinics) => [
  ...centers.map((c) => ({ ...c, kind: 'center', detail: c.org, hours: c.hours && `${c.hours} hours a week` })),
  ...clinics.map((c) => ({
    kind: 'city', name: c.site_name, detail: c.clinic_type, address: c.street_address, zip: '',
    phone: c.phone_1, hours: c.hours_of_operation, web: null, lat: c.lat, lng: c.lng,
  })),
]

// The closest few places to a neighborhood's center, or to `from` ([lat, lng]) when someone gave an address.
// shortcut: straight-line distance, not travel time; directions give the real route.
export function nearestPlaces(area, places, count = 5, from = null) {
  const c = from ?? centroid(area.feature.geometry)
  const seen = new Set() // HRSA lists some clinics once per suite; show each clinic once
  return places.map((p) => ({ ...p, d: km(c, [p.lat, p.lng]) })).sort((a, b) => a.d - b.d)
    .filter((p) => !seen.has(p.name) && seen.add(p.name)).slice(0, count)
}

export function Voice({ name }) {
  const form = feedbackUrl(name)
  return (
    <section className="voice" aria-label="Have your say">
      <h3>Your voice</h3>
      <p className="muted small">311 only counts what gets reported.</p>
      <a className="btn" href={CITY_311_URL} target="_blank" rel="noopener noreferrer">Report a problem to 311 →</a>
      {form && (
        <>
          <p className="muted small">Wrong hours or a closed clinic? Tell us. No health or personal details, please.</p>
          <a className="btn" href={form} target="_blank" rel="noopener noreferrer">Tell us what's missing →</a>
        </>
      )}
    </section>
  )
}

export default function HealthMap({ areas, clinics, centers }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [view, setView] = useState('map')
  const byId = Object.fromEntries(areas.map((a) => [a.id, a]))
  const area = sel && byId[sel]
  const features = { type: 'FeatureCollection', features: areas.map((a) => a.feature) }
  const places = buildPlaces(centers, clinics)
  const needle = q.trim().toLowerCase()
  const shown = places
    .filter((p) => !needle || `${p.name} ${p.address} ${p.zip} ${p.detail}`.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <p className="muted">
        {centers.length} community health centers (sliding scale, down to $0) and {clinics.length} city clinics. Shading is distance to the nearest city clinic. Click a dot for details.
      </p>
      <div className="legend">
        {Object.values(KINDS).map(([label, c]) => <span key={label}><i className="dot" style={{ background: c }} />{label}</span>)}
        {BINS.map(([max, c], i) => (
          <span key={c}><i style={{ background: c }} />{max === Infinity ? `${BINS[i - 1][0]}+ km` : `under ${max} km`}</span>
        ))}
      </div>
      <label className="search">Neighborhood
        <select value={sel ?? ''} onChange={(e) => setSel(e.target.value || null)}>
          <option value="">All of Chicago</option>
          {[...areas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => <option key={a.id} value={a.id}>{title(a.name)}</option>)}
        </select>
      </label>
      <div className="viewtoggle" role="group" aria-label="Map style">
        {[['map', 'Flat map'], ['3d', '3D view']].map(([k, label]) => (
          <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
        ))}
        {view === '3d' && <span className="muted small">Taller is farther from care.</span>}
      </div>
      <div className={area ? 'map-wrap open' : 'map-wrap'}>
      {view === '3d' ? (
        <Suspense fallback={<div className="map muted" role="status">Loading 3D view…</div>}>
          <Health3D areas={areas} places={places} kinds={KINDS} color={color} sel={sel} setSel={setSel} />
        </Suspense>
      ) : (
      <MapContainer center={[41.84, -87.68]} zoom={10} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={features}
          style={(f) => ({ color: '#4b5224', weight: 1, fillOpacity: 0.65, fillColor: color(byId[f.properties.area_numbe].clinicKm) })}
          onEachFeature={(f, layer) => {
            const a = byId[f.properties.area_numbe]
            // Portal text goes in as plain text, never HTML.
            const tip = document.createElement('div')
            tip.style.whiteSpace = 'pre-line'
            tip.textContent = `${title(a.name)}\nGrade ${a.grade} · nearest city clinic ${a.clinicKm.toFixed(1)} km\n${a.nearestClinic?.site_name ?? ''}`
            layer.bindTooltip(tip)
            layer.on('click', () => setSel(f.properties.area_numbe))
          }}
        />
        {area && <GeoJSON key={sel} data={area.feature} interactive={false} style={{ color: '#f7f2e4', weight: 3, fill: false }} />}
        <FitTo feature={area?.feature} />
        {/* City clinics drawn last so they sit on top where both share a building. */}
        {[...places].sort((a, b) => (a.kind === 'city') - (b.kind === 'city')).map((p) => (
          <CircleMarker key={p.kind + p.name + p.address} center={[p.lat, p.lng]} radius={p.kind === 'city' ? 6 : 5}
            pathOptions={{ color: '#152b12', weight: 1, fillColor: KINDS[p.kind][1], fillOpacity: 1 }}>
            <Popup><PlaceInfo p={p} /></Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      )}
      {area && <AreaPanel area={area} places={places} onClose={() => setSel(null)} />}
      </div>

      <h2>Find free or low-cost care</h2>
      <label className="search">Name, street or ZIP <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 60624" /></label>
      <table className="places">
        <thead><tr><th>Clinic</th><th>Address</th><th>Phone</th><th>Directions</th></tr></thead>
        <tbody>
          {!shown.length && <tr><td colSpan={4} className="muted">No clinic matches "{q}".</td></tr>}
          {shown.map((p) => (
            <tr key={p.kind + p.name + p.address}>
              <td><i className="dot" style={{ background: KINDS[p.kind][1] }} role="img" aria-label={KINDS[p.kind][0]} title={KINDS[p.kind][0]} />{p.name}</td>
              <td>{p.address} {p.zip}</td>
              <td>{p.phone && <a href={`tel:${p.phone}`}>{p.phone}</a>}</td>
              <td><a href={directions(p)} target="_blank" rel="noopener noreferrer">Get directions</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// Zoom to the picked neighborhood, or back out to the whole city when it's cleared.
function FitTo({ feature }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize() // the panel opening/closing changes the map's width
    if (feature) map.flyToBounds(L.geoJSON(feature).getBounds(), { padding: [30, 30], duration: 0.6 })
    else map.flyTo([41.84, -87.68], 10, { duration: 0.6 })
  }, [feature, map])
  return null
}

function AreaPanel({ area, places, onClose }) {
  const ref = useRef(null)
  // On phones the panel sits below the map; bring it into view. No-op when it's already visible.
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [area])
  const nearest = nearestPlaces(area, places)
  return (
    <aside className="area-panel" ref={ref} aria-live="polite">
      <button className="close" onClick={onClose} aria-label="Close neighborhood details">×</button>
      <h2>{title(area.name)} <span className={`grade g${area.grade}`}>{area.grade}</span></h2>
      <dl>
        <div><dt>Still open</dt><dd>{pct(area.openShare)}</dd></div>
        <div><dt>Avg days to close</dt><dd>{fmt(area.days, 1)}</dd></div>
        <div><dt>Requests / 1k residents</dt><dd>{fmt(area.perK)}</dd></div>
        <div><dt>Nearest city clinic</dt><dd>{fmt(area.clinicKm, 1)} km</dd></div>
      </dl>
      <a className="btn" href={`#neighborhood/${area.id}`}>Full neighborhood report →</a>
      <Voice name={title(area.name)} />
      <h3>Closest free or low-cost care</h3>
      <ol>
        {nearest.map((p) => (
          <li key={p.kind + p.name + p.address}>
            <span>
              <i className="dot" style={{ background: KINDS[p.kind][1] }} role="img" aria-label={KINDS[p.kind][0]} title={KINDS[p.kind][0]} />
              <b>{p.name}</b> <span className="muted">· {fmt(p.d, 1)} km</span>
            </span>
            <span className="muted">{p.address}{p.phone && <> · <a href={`tel:${p.phone}`}>{p.phone}</a></>}</span>
            <a href={directions(p)} target="_blank" rel="noopener noreferrer">Get directions →</a>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function PlaceInfo({ p }) {
  return (
    <div className="place">
      <b>{p.name}</b>
      <span>{KINDS[p.kind][0]}{p.detail && ` · ${p.detail}`}</span>
      <span>{p.address} {p.zip}</span>
      {p.hours && <span>{p.hours}</span>}
      {p.phone && <a href={`tel:${p.phone}`}>{p.phone}</a>}
      {p.web && <a href={p.web} target="_blank" rel="noopener noreferrer">Website</a>}
      <a className="go" href={directions(p)} target="_blank" rel="noopener noreferrer">Get directions →</a>
    </div>
  )
}
