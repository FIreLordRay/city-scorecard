import { useState } from 'react'
import { title, fmt, pct, pctRank, gradeOf, contains } from './score.js'
import { buildPlaces, nearestPlaces, directions, KINDS, Voice } from './HealthMap.jsx'

const METER = [0.6, 1.4]   // wait-index range the meter shows; 1.0 (city average) sits in the middle

// A report card for one neighborhood, in the spirit of a neighborhood guide: overall grade, a grade per
// measure, the numbers behind them, and the closest free or low-cost care.
const MEASURES = [
  ['openShare', '311 backlog', (a) => `${pct(a.openShare)} of requests are still open`],
  ['days', 'Speed of 311 fixes', (a) => (isFinite(a.days) ? `Requests take ${fmt(a.days, 1)} days to close on average` : 'No closed requests yet')],
  ['clinicKm', 'Clinic access', (a) => `Nearest city clinic is ${fmt(a.clinicKm, 1)} km away`],
]

// `point` ([lng, lat]) is set only when someone typed an address; it never goes in the URL.
export default function Profile({ id, areas, eq, clinics, centers, wards, point }) {
  const [shared, setShared] = useState('')
  const rank = areas.findIndex((a) => a.id === id)
  if (rank < 0) {
    return <p className="muted">We couldn't find that neighborhood. <a href="#neighborhood-scorecard">Browse all {areas.length}</a>.</p>
  }
  const a = areas[rank]
  const name = title(a.name)
  const gradeFor = (key) => gradeOf(1 - pctRank(areas.map((x) => x[key]), a[key]))
  const wait = eq.areas.find((x) => x.id === id)
  const waitGrade = wait && gradeOf(1 - pctRank(eq.areas.map((x) => x.index), wait.index))
  const nearest = nearestPlaces(a, buildPlaces(centers, clinics), 5, point && [point[1], point[0]])
  const ward = point && wards.find((w) => contains(w.geometry, point))

  async function share() {
    const url = `${location.origin}${location.pathname}#neighborhood/${id}`
    const text = `${name} gets a ${a.grade} on the Chicago City Scorecard.`
    try {
      if (navigator.share) await navigator.share({ title: 'Chicago City Scorecard', text, url })
      else { await navigator.clipboard.writeText(url); setShared('Link copied. It names the neighborhood, not your address.') }
    } catch { /* closing the share sheet is not an error */ }
  }

  return (
    <>
      <section className="hero">
        <span className={`grade big g${a.grade}`} aria-label={`Overall grade ${a.grade}`}>{a.grade}</span>
        <div>
          <h2>{name}</h2>
          <p className="muted">Ranked <strong>#{rank + 1}</strong> of {areas.length} Chicago neighborhoods for city service. Grades are relative, so some area always gets an F, and they rate the city's service, not the neighborhood or its people.</p>
          <button className="share" onClick={share}>Share this report</button>
          {shared && <p role="status" className="note">{shared}</p>}
        </div>
      </section>

      {wait && <WaitMeter index={wait.index} total={eq.areas.length} slowerThan={eq.areas.filter((x) => x.index < wait.index).length} />}

      <h2>Your ward</h2>
      {ward ? (
        <p className="ward">
          <strong>Ward {ward.ward} · Ald. {ward.alderman}</strong>
          <span className="links">
            {ward.phone && <a href={`tel:${ward.phone.replace(/[^\d+]/g, '')}`}>{ward.phone}</a>}
            {ward.email && <a href={`mailto:${ward.email}`}>Email</a>}
            {ward.website && <a href={ward.website} target="_blank" rel="noopener noreferrer">Website</a>}
          </span>
        </p>
      ) : (
        <p className="muted">
          {point ? 'No ward found for this address.' : <>Neighborhoods cross ward lines. <a href="#home">Look up your address</a> to see your ward and alderman.</>}
        </p>
      )}

      <h2>Report card</h2>
      <ul className="report">
        {MEASURES.map(([key, label, detail]) => (
          <li key={key}><span className={`grade g${gradeFor(key)}`}>{gradeFor(key)}</span><div><b>{label}</b><span className="muted">{detail(a)}</span></div></li>
        ))}
        <li>
          {wait
            ? <><span className={`grade g${waitGrade}`}>{waitGrade}</span><div><b>Fairness of waits</b><span className="muted">{fmt(wait.index, 2)}× the city average wait for the same kinds of requests · {pct(wait.low)} of households under $25k</span></div></>
            : <><span className="grade gNA">–</span><div><b>Fairness of waits</b><span className="muted">Not enough closed requests to compare</span></div></>}
        </li>
      </ul>

      <div className="kpis">
        <div className="kpi"><span className="muted">Requests</span><strong>{fmt(a.requests)}</strong></div>
        <div className="kpi"><span className="muted">Per 1,000 residents</span><strong>{fmt(a.perK)}</strong></div>
        <div className="kpi"><span className="muted">Still open</span><strong>{pct(a.openShare)}</strong></div>
      </div>

      <h2>Closest free or low-cost care <span className="muted small">{point ? 'from your address' : 'from the neighborhood center'}</span></h2>
      <ol className="nearest">
        {nearest.map((p) => (
          <li key={p.kind + p.name + p.address}>
            <span><i className="dot" style={{ background: KINDS[p.kind][1] }} role="img" aria-label={KINDS[p.kind][0]} title={KINDS[p.kind][0]} /><b>{p.name}</b> <span className="muted">· {fmt(p.d, 1)} km</span></span>
            <span className="muted">{p.address}{p.phone && <> · <a href={`tel:${p.phone}`}>{p.phone}</a></>}</span>
            <a href={directions(p)} target="_blank" rel="noopener noreferrer">Get directions →</a>
          </li>
        ))}
      </ol>

      <Voice name={name} />
      <p><a href="#health-access-map">See the health access map →</a> · <a href="#neighborhood-scorecard">All neighborhoods →</a></p>
    </>
  )
}

// Where this neighborhood's waits fall between faster and slower than the city average for the same requests.
function WaitMeter({ index, total, slowerThan }) {
  const at = Math.min(Math.max((index - METER[0]) / (METER[1] - METER[0]), 0), 1)
  const faster = index < 1
  return (
    <section className="wait">
      <p className="wait-stat">
        311 requests here take <strong>{pct(Math.abs(index - 1))} {faster ? 'less' : 'more'} time</strong> to close than the city average for the same kinds of requests.
      </p>
      <div className="wait-meter" role="img" aria-label={`${fmt(index, 2)} times the city average. Faster than average is left, slower is right.`}>
        <span className="avg" />
        <span className="mark" style={{ left: `${at * 100}%` }} />
      </div>
      <p className="wait-scale" aria-hidden="true"><span>faster</span><span>city average</span><span>slower</span></p>
      <p className="muted">{fmt(index, 2)}× the average · slower than {slowerThan} of {total} neighborhoods</p>
    </section>
  )
}
