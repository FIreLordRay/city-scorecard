import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from 'react-leaflet'
import { title } from './score.js'

const BINS = [[2, '#fbbf24'], [4, '#f59e0b'], [6, '#d97706'], [8, '#c2410c'], [Infinity, '#7c2d12']]
const color = (d) => BINS.find(([max]) => d < max)[1]

export default function HealthMap({ areas, clinics }) {
  const byId = Object.fromEntries(areas.map((a) => [a.id, a]))
  const features = { type: 'FeatureCollection', features: areas.map((a) => a.feature) }
  return (
    <>
      <p className="muted">Neighborhoods shaded by distance from their center to the nearest Chicago Department of Public Health clinic ({clinics.length} clinics: WIC, mental health, STI). Darker means farther. Click a dot for clinic details.</p>
      <div className="legend">
        {BINS.map(([max, c], i) => (
          <span key={c}><i style={{ background: c }} />{max === Infinity ? `${BINS[i - 1][0]}+ km` : `under ${max} km`}</span>
        ))}
      </div>
      <MapContainer center={[41.84, -87.68]} zoom={10} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={features}
          style={(f) => ({ color: '#332a22', weight: 1, fillOpacity: 0.65, fillColor: color(byId[f.properties.area_numbe].clinicKm) })}
          onEachFeature={(f, layer) => {
            const a = byId[f.properties.area_numbe]
            // Portal text goes in as plain text, never HTML.
            const tip = document.createElement('div')
            tip.style.whiteSpace = 'pre-line'
            tip.textContent = `${title(a.name)}\nGrade ${a.grade} · nearest clinic ${a.clinicKm.toFixed(1)} km\n${a.nearestClinic?.site_name ?? ''}`
            layer.bindTooltip(tip)
          }}
        />
        {clinics.map((c) => (
          <CircleMarker key={c.site_name + c.street_address} center={[c.lat, c.lng]} radius={6} pathOptions={{ color: '#f7f2ec', fillColor: '#f7f2ec', fillOpacity: 1 }}>
            <Popup><b>{c.site_name}</b><br />{c.clinic_type}<br />{c.street_address}<br />{c.hours_of_operation}<br />{c.phone_1}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </>
  )
}
