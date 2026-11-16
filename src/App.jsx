import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Star, LayoutGrid, MapPin, Scale, House } from 'lucide-react'
import { loadAll, DAYS } from './data.js'
import { rateServices, scoreAreas, equity, title, fmt, pct } from './score.js'
import HealthMap from './HealthMap.jsx'
import Profile from './Profile.jsx'
import Landing from './Landing.jsx'
import NeighborhoodSearch from './NeighborhoodSearch.jsx'
import Comments from './Comments.jsx'

const TABS = ['Service tracker', 'Service ratings', 'Neighborhood scorecard', 'Health access map', 'Who waits longer']
const SLUGS = TABS.map((t) => t.toLowerCase().replaceAll(' ', '-'))
const ICONS = [ClipboardList, Star, LayoutGrid, MapPin, Scale]
// The 3D skyline now lives on the Who waits longer page; old #3d-skyline links land there.
const ALIASES = { '3d-skyline': 'who-waits-longer' }
// The open view lives in the URL hash, so refresh and shared links (#who-waits-longer) land on it.
// A neighborhood report lives at #neighborhood/<id> and is no tab, so its tab number is -1.
const profileFromHash = () => location.hash.match(/^#neighborhood\/(.+)$/)?.[1] ?? null
// The front door is -2: an empty or unknown hash lands there, so nothing shows until it's asked for.
const HOME = -2
const tabFromHash = () => {
  if (profileFromHash()) return -1
  const h = location.hash.slice(1)
  const i = SLUGS.indexOf(ALIASES[h] ?? h)
  return i < 0 ? HOME : i
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(tabFromHash)
  const [pid, setPid] = useState(profileFromHash)
  const [centers, setCenters] = useState([])

  useEffect(() => {
    const onHash = () => { setTab(tabFromHash()); setPid(profileFromHash()); window.scrollTo(0, 0) }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    // Show the saved snapshot right away, then swap in live data when the portal answers.
    let live = false
    fetch('./snapshot.json').then((r) => (r.ok ? r.json() : null)).then((s) => s && !live && setData(s), () => {})
    loadAll().then((d) => { live = true; setData(d) }, (e) => setError(e.message))
    // Saved by `npm run snapshot` from HRSA; the map still works without it.
    fetch('./health-centers.json').then((r) => (r.ok ? r.json() : null)).then((h) => h && setCenters(h.list), () => {})
  }, [])
  const areas = useMemo(() => data && scoreAreas(data), [data])
  const eq = useMemo(() => data && equity(data.byAreaType, data.lowIncome), [data])
  const saved = data?.savedAt && new Date(data.savedAt).toLocaleDateString()

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand"><a href="#home">Chicago City Scorecard</a></p>
        <nav aria-label="Views">
          <a href="#home" aria-current={tab === HOME ? 'page' : undefined}><House size={18} aria-hidden="true" />Home</a>
          {TABS.map((t, i) => {
            const Icon = ICONS[i]
            return (
              <a key={t} href={`#${SLUGS[i]}`} aria-current={tab === i ? 'page' : undefined}>
                <Icon size={18} aria-hidden="true" />{t}
              </a>
            )
          })}
        </nav>
        <p className="muted small">Data: City of Chicago, HRSA.</p>
      </aside>
      <div className="content">
        {tab !== HOME && <header className="topbar">
          <div>
            <h1>{pid ? (areas ? title(areas.find((a) => a.id === pid)?.name ?? 'Neighborhood') : 'Neighborhood') : TABS[tab]}</h1>
            <p className="muted">Last {DAYS} days of 311 data.</p>
          </div>
          {areas && <NeighborhoodSearch areas={areas} />}
          {data && (
            <p className={`status ${saved ? 'saved' : 'live'}`} role="status">
              {!saved ? 'Live data' : error ? `Saved ${saved}` : `Saved ${saved} · updating…`}
            </p>
          )}
        </header>}
        <main className="panel" aria-busy={!data && !error}>
        {error && !data && <p role="alert" className="error">Could not load city data: {error}</p>}
        {!data && !error && <p className="muted" role="status">Loading city data…</p>}
        {tab === HOME && <Landing areas={areas} />}
        {data && tab === 0 && <><Finding e={eq} /><Tracker types={data.types} /></>}
        {data && tab === 1 && <Ratings types={data.types} />}
        {data && tab === 2 && <Scorecard areas={areas} />}
        {data && tab === 3 && <HealthMap areas={areas} clinics={data.clinics} centers={centers} />}
        {data && tab === 4 && <Fairness data={data} areas={areas} e={eq} />}
        {data && pid && <Profile id={pid} areas={areas} eq={eq} clinics={data.clinics} centers={centers} />}
        </main>
      </div>
    </div>
  )
}

// The app's headline result, shown on the landing view so visitors see it without digging.
function Finding({ e }) {
  const gap = e.poor / e.rich - 1
  if (gap <= 0.05) return null
  return (
    <a className="finding" href="#who-waits-longer">
      <strong>{pct(gap)} longer</strong>
      <span>Same 311 request, poorest vs. richest neighborhoods.</span>
      <span className="cta">See who waits longer →</span>
    </a>
  )
}

const SORTS = [
  ['n', 'Most requested', (t) => t.n],
  ['days', 'Slowest to close', (t) => t.days ?? -1],
  ['open', 'Most still open', (t) => t.open / t.n],
]

function Tracker({ types }) {
  const [sort, setSort] = useState('n')
  const total = types.reduce((s, t) => s + t.n, 0)
  const open = types.reduce((s, t) => s + t.open, 0)
  const closed = types.filter((t) => t.days != null)
  // Average close time weighted by how many requests of each type were closed.
  const avgDays = closed.reduce((s, t) => s + t.days * (t.n - t.open), 0) / closed.reduce((s, t) => s + t.n - t.open, 0)
  const by = SORTS.find(([k]) => k === sort)[2]
  const rows = [...types].sort((a, b) => by(b) - by(a)).slice(0, 20)
  const maxN = Math.max(...rows.map((t) => t.n))
  return (
    <>
      <div className="kpis">
        <Kpi label="Requests" value={fmt(total)} />
        <Kpi label="Still open" value={fmt(open)} note={pct(open / total)} />
        <Kpi label="Avg days to close" value={fmt(avgDays, 1)} />
      </div>
      <div className="list-head">
        <h2>Top 20 services</h2>
        <div className="seg" role="group" aria-label="Sort services">
          {SORTS.map(([k, label]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
      </div>
      <ol className="svc-list">
        {rows.map((t) => {
          const slow = t.days != null && t.days > avgDays
          return (
            <li key={t.sr_type}>
              <div className="svc-head"><b>{t.sr_type}</b><span className="muted">{fmt(t.n)} requests</span></div>
              <div className="meter" role="img" aria-label={`${fmt(t.n)} requests`}><span style={{ width: `${(t.n / maxN) * 100}%` }} /></div>
              <div className="svc-stats">
                <span className="chip">{pct(t.open / t.n)} still open</span>
                <span className={slow ? 'chip slow' : 'chip fast'}>{t.days == null ? 'No close time' : `${fmt(t.days, 1)} days to close`}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}

const TIERS = { 5: 'Best rated', 4: 'Above average', 3: 'Middle of the pack', 2: 'Below average', 1: 'Lowest rated' }

function Ratings({ types }) {
  const rated = rateServices(types)
  return (
    <>
      <p className="muted">Rated on speed and backlog from 311 records, not votes.</p>
      {[5, 4, 3, 2, 1].map((n) => {
        const group = rated.filter((t) => t.stars === n)
        if (!group.length) return null
        return (
          <section key={n} className="tier">
            <h2>
              <span className="stars" aria-hidden="true">{'★'.repeat(n)}<span>{'★'.repeat(5 - n)}</span></span>
              {TIERS[n]} <span className="muted small">{group.length}</span>
            </h2>
            <div className="cards">
              {group.map((t) => (
                <div key={t.sr_type} className="card">
                  <b>{t.sr_type}</b>
                  <div className="meter" role="img" aria-label={`${pct(1 - t.open / t.n)} closed`}><span style={{ width: pct(1 - t.open / t.n) }} /></div>
                  <dl>
                    <div><dt>Closed</dt><dd>{pct(1 - t.open / t.n)}</dd></div>
                    <div><dt>Avg days</dt><dd>{fmt(t.days, 1)}</dd></div>
                    <div><dt>Requests</dt><dd>{fmt(t.n)}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

const AREA_COLS = [['name', 'Neighborhood'], ['score', 'Grade'], ['openShare', 'Open'], ['days', 'Avg days'],
  ['clinicKm', 'Nearest clinic'], ['perK', 'Requests / 1k residents']]

function Scorecard({ areas }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'score', dir: -1 })
  const shown = areas.filter((a) => a.name.includes(q.trim().toUpperCase())).sort((a, b) => {
    const [x, y] = [a[sort.key], b[sort.key]]
    if (x == null || y == null) return (x == null) - (y == null) // missing values always last
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
  })
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'score' ? -1 : 1 }))
  return (
    <>
      <p className="muted">Graded on 311 backlog, close time and clinic distance. Grades rate city service, not the neighborhood.</p>
      <details className="method">
        <summary>How grades work</summary>
        <ul>
          <li>Ranks on the three measures are averaged. Top fifth gets an A, bottom fifth an F, so some area always gets an F.</li>
          <li>311 counts complaints, not problems. Areas that call less can look better served.</li>
          <li>Clinic distance is a straight line to the nearest of 24 city clinics.</li>
        </ul>
      </details>
      <label className="search">Filter <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Englewood" /></label>
      <table>
        <thead>
          <tr>
            {AREA_COLS.map(([key, label]) => (
              <th key={key} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                <button className="sort" onClick={() => sortBy(key)}>
                  {label}<span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!shown.length && <tr><td colSpan={AREA_COLS.length} className="muted">No neighborhood matches "{q}".</td></tr>}
          {shown.map((a) => (
            <tr key={a.id}>
              <td><a href={`#neighborhood/${a.id}`}>{title(a.name)}</a></td>
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

function Fairness({ data, areas, e }) {
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
      <h2>Lower income, longer wait</h2>
      <p className="muted">Each dot is a neighborhood.</p>
      <Scatter points={e.areas.map((a) => ({ ...a, name: names[a.id] }))} rich={e.rich} poor={e.poor} />
      <details className="method">
        <summary>See as a table</summary>
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
      <h2>In 3D</h2>
      <p className="muted">Taller is a longer wait. Gold is faster than average, rose is slower.</p>
      <video className="skyline" src="./skyline_loop.mp4" poster="./skyline.png" controls loop muted autoPlay playsInline
        aria-label="Spinning 3D model of Chicago neighborhoods raised by wait time" />
      <details className="method">
        <summary>How it's measured</summary>
        <ul>
          <li>Each area is compared with the city average for its own mix of requests. Same-day services are left out.</li>
          <li>Richest and poorest fifth: smallest and largest share of households under $25k (Census).</li>
          <li>Closed tickets only, last {DAYS} days. Shows income and wait go together, not why.</li>
        </ul>
      </details>
      <Comments topic="who-waits-longer" question="Does this match what you see in your neighborhood?" />
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
