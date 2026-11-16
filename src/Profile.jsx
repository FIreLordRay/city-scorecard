import { title, fmt, pct, pctRank, gradeOf } from './score.js'
import Comments from './Comments.jsx'
import { buildPlaces, nearestPlaces, directions, KINDS, Voice } from './HealthMap.jsx'

// A report card for one neighborhood, in the spirit of a neighborhood guide: overall grade, a grade per
// measure, the numbers behind them, and the closest free or low-cost care.
const MEASURES = [
  ['openShare', '311 backlog', (a) => `${pct(a.openShare)} of requests are still open`],
  ['days', 'Speed of 311 fixes', (a) => (isFinite(a.days) ? `Requests take ${fmt(a.days, 1)} days to close on average` : 'No closed requests yet')],
  ['clinicKm', 'Clinic access', (a) => `Nearest city clinic is ${fmt(a.clinicKm, 1)} km away`],
]

export default function Profile({ id, areas, eq, clinics, centers }) {
  const rank = areas.findIndex((a) => a.id === id)
  if (rank < 0) {
    return <p className="muted">We couldn't find that neighborhood. <a href="#neighborhood-scorecard">Browse all {areas.length}</a>.</p>
  }
  const a = areas[rank]
  const name = title(a.name)
  const gradeFor = (key) => gradeOf(1 - pctRank(areas.map((x) => x[key]), a[key]))
  const wait = eq.areas.find((x) => x.id === id)
  const waitGrade = wait && gradeOf(1 - pctRank(eq.areas.map((x) => x.index), wait.index))
  const nearest = nearestPlaces(a, buildPlaces(centers, clinics), 5)

  return (
    <>
      <section className="hero">
        <span className={`grade big g${a.grade}`} aria-label={`Overall grade ${a.grade}`}>{a.grade}</span>
        <div>
          <h2>{name}</h2>
          <p className="muted">Ranked <strong>#{rank + 1}</strong> of {areas.length} for city service. Grades rate the city, not residents.</p>
        </div>
      </section>

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

      <h2>Closest free or low-cost care</h2>
      <ol className="nearest">
        {nearest.map((p) => (
          <li key={p.kind + p.name + p.address}>
            <span><i className="dot" style={{ background: KINDS[p.kind][1] }} role="img" aria-label={KINDS[p.kind][0]} title={KINDS[p.kind][0]} /><b>{p.name}</b> <span className="muted">· {fmt(p.d, 1)} km</span></span>
            <span className="muted">{p.address}{p.phone && <> · <a href={`tel:${p.phone}`}>{p.phone}</a></>}</span>
            <a href={directions(p)} target="_blank" rel="noopener noreferrer">Get directions →</a>
          </li>
        ))}
      </ol>

      <Comments topic={`neighborhood/${id}`} question={`Is this grade fair for ${name}?`} />
      <Voice name={name} />
      <p><a href={`#service-tracker/${id}`}>See its 311 services →</a> · <a href="#health-access-map">See the health access map →</a> · <a href="#neighborhood-scorecard">All neighborhoods →</a></p>
    </>
  )
}
