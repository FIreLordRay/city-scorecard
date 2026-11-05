import { useEffect, useMemo, useState } from 'react'
import { loadAll, DAYS } from './data.js'
import { rateServices, scoreAreas, equity, title } from './score.js'
import HealthMap from './HealthMap.jsx'

const TABS = ['Service tracker', 'Service ratings', 'Neighborhood scorecard', 'Health access map', 'Who waits longer']
const SLUGS = TABS.map((t) => t.toLowerCase().replaceAll(' ', '-'))
// The open view lives in the URL hash, so refresh and shared links (#who-waits-longer) land on it.
const tabFromHash = () => Math.max(0, SLUGS.indexOf(location.hash.slice(1)))
const fmt = (n, d = 0) => (n == null || !isFinite(n) ? '–' : n.toLocaleString(undefined, { maximumFractionDigits: d }))
const pct = (x) => `${Math.round(x * 100)}%`

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    // Show the saved snapshot right away, then swap in live data when the portal answers.
    let live = false
    fetch('./snapshot.json').then((r) => (r.ok ? r.json() : null)).then((s) => s && !live && setData(s), () => {})
    loadAll().then((d) => { live = true; setData(d) }, (e) => setError(e.message))
  }, [])
  const areas = useMemo(() => data && scoreAreas(data), [data])

  return (
    <div className="page">
      <header>
        <img src="./favicon.svg" alt="" width="36" height="36" />
        <div>
          <h1>Chicago City Scorecard</h1>
          <p className="muted">How well is the city serving its residents? Last {DAYS} days of 311 data from the Chicago Data Portal.</p>
          {data?.savedAt && (
            <p className="muted" role="status">
              Showing saved data from {new Date(data.savedAt).toLocaleDateString()}.{' '}
              {error ? 'Live data could not be loaded.' : 'Checking for live data…'}
            </p>
          )}
        </div>
      </header>
      <nav aria-label="Views">
        {TABS.map((t, i) => (
          <a key={t} href={`#${SLUGS[i]}`} aria-current={tab === i ? 'page' : undefined}>{t}</a>
        ))}
      </nav>
      <main aria-busy={!data && !error}>
        {error && !data && <p role="alert" className="error">Could not load city data: {error}</p>}
        {!data && !error && <p className="muted" role="status">Loading city data…</p>}
        {data && tab === 0 && <Tracker types={data.types} />}
        {data && tab === 1 && <Ratings types={data.types} />}
        {data && tab === 2 && <Scorecard areas={areas} />}
        {data && tab === 3 && <HealthMap areas={areas} clinics={data.clinics} />}
        {data && tab === 4 && <Fairness data={data} areas={areas} />}
      </main>
    </div>
  )
}

function Tracker({ types }) {
  const total = types.reduce((s, t) => s + t.n, 0)
  const open = types.reduce((s, t) => s + t.open, 0)
  const closed = types.filter((t) => t.days != null)
  // Average close time weighted by how many requests of each type were closed.
  const avgDays = closed.reduce((s, t) => s + t.days * (t.n - t.open), 0) / closed.reduce((s, t) => s + t.n - t.open, 0)
  return (
    <>
      <div className="kpis">
        <Kpi label="Requests" value={fmt(total)} />
        <Kpi label="Still open" value={fmt(open)} note={pct(open / total)} />
        <Kpi label="Avg days to close" value={fmt(avgDays, 1)} />
      </div>
      <h2>Most requested services</h2>
      <table>
        <thead><tr><th>Service</th><th>Requests</th><th>Open</th><th>Avg days to close</th></tr></thead>
        <tbody>
          {types.slice(0, 20).map((t) => (
            <tr key={t.sr_type}>
              <td>{t.sr_type}</td><td>{fmt(t.n)}</td>
              <td><Bar value={t.open / t.n} /> {pct(t.open / t.n)}</td>
              <td>{fmt(t.days, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Ratings({ types }) {
  const rated = rateServices(types)
  return (
    <>
      <p className="muted">Stars are computed from 311 records, not resident votes. Each service with 100+ requests is ranked against the others on how fast tickets get closed and how many are still open. A closed ticket means the city marked it done, not that the fix was checked.</p>
      <table>
        <thead><tr><th>Service</th><th>Rating</th><th>Closed</th><th>Avg days</th><th>Requests</th></tr></thead>
        <tbody>
          {rated.map((t) => (
            <tr key={t.sr_type}>
              <td>{t.sr_type}</td>
              <td className="stars" aria-label={`${t.stars} out of 5 stars`}>{'★'.repeat(t.stars)}<span>{'★'.repeat(5 - t.stars)}</span></td>
              <td>{pct(1 - t.open / t.n)}</td><td>{fmt(t.days, 1)}</td><td>{fmt(t.n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Scorecard({ areas }) {
  const [q, setQ] = useState('')
  const shown = areas.filter((a) => a.name.includes(q.toUpperCase()))
  return (
    <>
      <p className="muted">All 77 community areas, graded against each other on 311 backlog, ticket close time, and distance to the nearest city health clinic. Grades rate the city's service, not the neighborhood.</p>
      <details className="method">
        <summary>How grades work and what they miss</summary>
        <ul>
          <li>Each area is ranked on the three measures, the ranks are averaged, and the top fifth gets an A, the bottom fifth an F. Grades are relative, so some area always gets an F.</li>
          <li>311 counts complaints, not problems. Areas where fewer people call 311 can look better served than they are.</li>
          <li>Clinic distance is a straight line from the area's center to the nearest of 24 city clinics. It ignores community health centers, hospitals and transit.</li>
        </ul>
      </details>
      <label className="search">Find a neighborhood <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Englewood" /></label>
      <table>
        <thead><tr><th>Neighborhood</th><th>Grade</th><th>Open</th><th>Avg days</th><th>Nearest clinic</th><th>Requests / 1k residents</th></tr></thead>
        <tbody>
          {shown.map((a) => (
            <tr key={a.id}>
              <td>{title(a.name)}</td>
              <td><span className={`grade g${a.grade}`}>{a.grade}</span></td>
              <td>{pct(a.openShare)}</td><td>{fmt(a.days, 1)}</td>
              <td>{fmt(a.clinicKm, 1)} km</td><td>{fmt(a.perK)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Fairness({ data, areas }) {
  const e = useMemo(() => equity(data.byAreaType, data.lowIncome), [data])
  const names = Object.fromEntries(areas.map((a) => [a.id, title(a.name)]))
  const gap = e.poor / e.rich - 1
  const top = e.services[0]
  // The live number moves day to day, so the headline always says which 90 days it covers.
  const asOf = new Date(data.savedAt ?? Date.now()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  return (
    <>
      <p className="headline">
        {gap > 0.05
          ? <>In Chicago's poorest neighborhoods, the same type of 311 request takes <strong>{pct(gap)} longer</strong> to close than in the richest.</>
          : <>The same type of 311 request takes about as long to close in poor neighborhoods as in rich ones.</>}
      </p>
      <p className="muted">90 days ending {asOf}.</p>
      {top && top.poor > top.rich * 1.5 && (
        <p className="muted">Biggest gap: {top.type}, {fmt(top.rich, 1)} days in the richest areas vs {fmt(top.poor, 1)} in the poorest.</p>
      )}
      <h2>Neighborhoods with more low-income households wait longer</h2>
      <p className="muted">Each dot is a neighborhood: how long its requests take compared with the city average for the same kinds of requests.</p>
      <Scatter points={e.areas.map((a) => ({ ...a, name: names[a.id] }))} rich={e.rich} poor={e.poor} />
      <details className="method">
        <summary>All {e.areas.length} neighborhoods as a table</summary>
        <table>
          <thead><tr><th>Neighborhood</th><th>Wait vs city average</th><th>Households under $25k</th></tr></thead>
          <tbody>
            {[...e.areas].sort((a, b) => b.index - a.index).map((a) => (
              <tr key={a.id}><td>{names[a.id]}</td><td>{fmt(a.index, 2)}×</td><td>{pct(a.low)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
      <h2>By service</h2>
      <table>
        <thead><tr><th>Service</th><th>Richest fifth</th><th>Poorest fifth</th><th>Gap</th></tr></thead>
        <tbody>
          {e.services.map((s) => (
            <tr key={s.type}>
              <td>{s.type}</td><td>{fmt(s.rich, 1)} days</td><td>{fmt(s.poor, 1)} days</td>
              <td>{fmt(s.poor / s.rich, 1)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="method">
        <summary>How this is measured and what it can't tell you</summary>
        <ul>
          <li>Each neighborhood's close times are compared with the city average for its own mix of requests, so an area isn't penalized for filing slower kinds of requests. Same-day services are left out.</li>
          <li>"Richest" and "poorest" fifth are the areas with the smallest and largest share of households earning under $25k (Census ACS).</li>
          <li>It only counts tickets that were closed, over the last {DAYS} days. It shows that income and wait go together, not why. District staffing could be the reason.</li>
        </ul>
      </details>
    </>
  )
}

function Scatter({ points, rich, poor }) {
  const W = 640, H = 320, L = 52, R = 24, T = 20, B = 44
  const xs = points.map((p) => p.low), ys = points.map((p) => p.index)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const x = (v) => L + ((v - minX) / (maxX - minX)) * (W - L - R)
  const y = (v) => H - B - ((v - minY) / (maxY - minY)) * (H - T - B)
  // Same fifths as equity(): sorted by low-income share.
  const sorted = [...points].sort((a, b) => a.low - b.low)
  const k = Math.max(1, Math.floor(sorted.length / 5))
  const groups = [[sorted.slice(0, k), rich, 'richest fifth avg'], [sorted.slice(-k), poor, 'poorest fifth avg']]
  const poorIds = new Set(sorted.slice(-k).map((p) => p.id))
  const byWait = [...points].sort((a, b) => b.index - a.index)
  const labeled = [byWait[0], byWait[1], byWait.at(-1)]
  const yTicks = [0.8, 1, 1.2, 1.4].filter((t) => t >= minY && t <= maxY)
  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scatter" role="img"
        aria-label={`Scatter plot of ${points.length} neighborhoods. The poorest fifth averages ${fmt(poor, 2)} times the city average wait; the richest fifth averages ${fmt(rich, 2)}. The table below lists every neighborhood.`}>
        {/* Range-frame axes: lines span only the data. */}
        <line x1={x(minX)} x2={x(maxX)} y1={H - B + 8} y2={H - B + 8} className="axis" />
        <line x1={L - 8} x2={L - 8} y1={y(minY)} y2={y(maxY)} className="axis" />
        {[0.1, 0.2, 0.3, 0.4, 0.5].filter((t) => t >= minX && t <= maxX).map((t) => (
          <text key={t} x={x(t)} y={H - B + 24} textAnchor="middle">{pct(t)}</text>
        ))}
        {yTicks.map((t) => <text key={t} x={L - 14} y={y(t) + 4} textAnchor="end">{fmt(t, 1)}×</text>)}
        <text x={W - R} y={H - 6} textAnchor="end">households under $25k →</text>
        <line x1={x(minX)} x2={x(maxX)} y1={y(1)} y2={y(1)} className="ref" />
        <text x={x(maxX)} y={y(1) + 16} textAnchor="end">city average</text>
        {points.map((p) => (
          <circle key={p.id} cx={x(p.low)} cy={y(p.index)} r="4.5" className={poorIds.has(p.id) ? 'hi' : undefined}>
            <title>{`${p.name}: ${fmt(p.index, 2)}× city average, ${pct(p.low)} of households under $25k`}</title>
          </circle>
        ))}
        {groups.map(([g, avg, label]) => {
          const [x1, x2] = [x(g[0].low), x(g.at(-1).low)]
          return (
            <g key={label} className="avg">
              <line x1={x1} x2={x2} y1={y(avg)} y2={y(avg)} />
              <text x={(x1 + x2) / 2} y={y(avg) + (avg > 1 ? -8 : 16)} textAnchor="middle">{label} {fmt(avg, 2)}×</text>
            </g>
          )
        })}
        {labeled.map((p) => {
          const right = x(p.low) > W * 0.7
          return (
            <text key={p.id} className="label" x={x(p.low) + (right ? -8 : 8)} y={y(p.index) + 4} textAnchor={right ? 'end' : 'start'}>
              {p.name}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function Kpi({ label, value, note }) {
  return <div className="kpi"><span className="muted">{label}</span><strong>{value}</strong>{note && <span className="muted">{note}</span>}</div>
}

function Bar({ value }) {
  return <span className="bar" aria-hidden="true"><span style={{ width: pct(value) }} /></span>
}
