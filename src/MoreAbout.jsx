import { ShieldCheck, TrainFront, Building2, Utensils } from 'lucide-react'
import { centroid, km, fmt, pct } from './score.js'

const LINE_COLORS = { Red: '#c60c30', Blue: '#00a1de', Green: '#009b3a', Brown: '#62361b', Purple: '#522398', Yellow: '#f9e300', Pink: '#e27ea6', Orange: '#f9461c' }
const vs = (here, city) => (here > city ? 'above' : here < city ? 'below' : 'the same as')

// Safety, transit, housing and food for one neighborhood, from public/extras.json (saved by `npm run snapshot`).
// `from` is [lat, lng]: the typed address when there is one, otherwise the neighborhood center.
export default function MoreAbout({ area, name, pop, extras, from }) {
  const s = extras.areas[area.id]
  if (!s) return null
  const c = from ?? centroid(area.feature.geometry)
  const station = extras.lStations.map((st) => ({ ...st, d: km(c, [st.lat, st.lng]) })).sort((a, b) => a.d - b.d)[0]
  const docks = extras.divvy.filter(([lat, lng]) => km(c, [lat, lng]) <= 0.5).length
  const arrest = s.crimes ? s.arrests / s.crimes : null
  const fail = s.inspections ? s.fails / s.inspections : null
  const perK = (n) => (pop ? fmt((n / pop) * 1000, 1) : null)

  return (
    <section className="more" aria-labelledby="more-h">
      <h2 id="more-h">More about {name} <span className="muted small">last {extras.days} days · {from ? 'from your address' : 'from the neighborhood center'}</span></h2>
      <div className="more-grid">
        <article>
          <h3><ShieldCheck size={20} aria-hidden="true" /> Safety response</h3>
          {arrest == null ? <p className="muted">No reported crimes in this period.</p> : <>
            <p className="big">{pct(arrest)}</p>
            <p>of {fmt(s.crimes)} reported crimes led to an arrest, {vs(arrest, extras.city.arrestShare)} the city's {pct(extras.city.arrestShare)}.</p>
          </>}
          <p className="muted small">An arrest isn't a conviction, and it measures police follow-through, not how safe people are.</p>
        </article>

        <article>
          <h3><TrainFront size={20} aria-hidden="true" /> Getting around</h3>
          {station && <>
            <p className="big">{fmt(station.d, 1)} km</p>
            <p>to the nearest 'L': <b>{station.name}</b>{' '}
              {station.lines.map((l) => <span key={l} className="line" style={{ background: LINE_COLORS[l], color: l === 'Yellow' ? '#152b12' : '#fff' }}>{l}</span>)}
              {station.ada && <span className="muted small"> · accessible</span>}</p>
          </>}
          <p>{docks ? `${docks} Divvy bike station${docks > 1 ? 's' : ''}` : 'No Divvy bike stations'} within a 6-minute walk (500 m).</p>
        </article>

        <article>
          <h3><Building2 size={20} aria-hidden="true" /> Housing</h3>
          <p className="big">{fmt(s.violations)}</p>
          <p>building code violations at {fmt(s.buildings)} buildings{perK(s.violations) && ` (${perK(s.violations)} per 1,000 residents)`}. {fmt(s.openViolations)} still open.</p>
          <p>{s.affordableUnits ? `${fmt(s.affordableUnits)} city-supported affordable rental units.` : 'No city-supported affordable rental developments listed.'}</p>
        </article>

        <article>
          <h3><Utensils size={20} aria-hidden="true" /> Food safety</h3>
          {fail == null ? <p className="muted">No restaurant inspections in this period.</p> : <>
            <p className="big">{pct(fail)}</p>
            <p>of {fmt(s.inspections)} restaurant inspections failed ({fmt(s.fails)}), {vs(fail, extras.city.failShare)} the city's {pct(extras.city.failShare)}.</p>
          </>}
          {s.inspections > 0 && s.inspections < 20 && <p className="muted small">Few inspections, so one result moves this a lot.</p>}
        </article>
      </div>
      <p className="muted small">Sources: Chicago Data Portal crimes, CTA 'L' stops, Divvy stations, building violations, affordable rental housing and food inspections. Saved {new Date(extras.savedAt).toLocaleDateString()}.</p>
    </section>
  )
}
