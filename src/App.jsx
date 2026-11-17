import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Star, LayoutGrid, MapPin, Scale, House } from 'lucide-react'
import { loadAll, DAYS } from './data.js'
import { rateServices, scoreAreas, equity, title, fmt, pct } from './score.js'
import HealthMap from './HealthMap.jsx'
import Profile from './Profile.jsx'
import Landing from './Landing.jsx'
import NeighborhoodSearch from './NeighborhoodSearch.jsx'
import Comments from './Comments.jsx'
import { all as allRatings, add as addRating, average } from './ratings.js'
import { CITY_311_URL } from './config.js'

const TABS = ['Service tracker', 'Service ratings', 'Neighborhood scorecard', 'Health access map', 'Who waits longer']
const SLUGS = TABS.map((t) => t.toLowerCase().replaceAll(' ', '-'))
const ICONS = [ClipboardList, Star, LayoutGrid, MapPin, Scale]
// The 3D skyline page was removed; old #3d-skyline links land on the related wait-time page.
const ALIASES = { '3d-skyline': 'who-waits-longer' }
// The open view lives in the URL hash, so refresh and shared links (#who-waits-longer) land on it.
// A neighborhood report lives at #neighborhood/<id> and is no tab, so its tab number is -1.
const profileFromHash = () => location.hash.match(/^#neighborhood\/(.+)$/)?.[1] ?? null
// The Service tracker can be opened for one neighborhood: #service-tracker/<id>.
const trackerAreaFromHash = () => location.hash.match(/^#service-tracker\/(.+)$/)?.[1] ?? null
// The front door is -2: an empty or unknown hash lands there, so nothing shows until it's asked for.
const HOME = -2
const tabFromHash = () => {
  if (profileFromHash()) return -1
  if (trackerAreaFromHash()) return 0
  const h = location.hash.slice(1)
  const i = SLUGS.indexOf(ALIASES[h] ?? h)
  return i < 0 ? HOME : i
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(tabFromHash)
  const [pid, setPid] = useState(profileFromHash)
  const [tid, setTid] = useState(trackerAreaFromHash)
  const [centers, setCenters] = useState([])
  const [wards, setWards] = useState([])
  const [extras, setExtras] = useState(null)
  // The address someone looked up, as a map point, kept in memory only (never in the URL).
  const [here, setHere] = useState(null)

  useEffect(() => {
    const onHash = () => { setTab(tabFromHash()); setPid(profileFromHash()); setTid(trackerAreaFromHash()); window.scrollTo(0, 0) }
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
    // Saved by `npm run snapshot`; without it the report just can't name a ward.
    fetch('./wards.json').then((r) => (r.ok ? r.json() : null)).then((w) => w && setWards(w.list), () => {})
    // Saved by `npm run snapshot`; without it the report skips the safety, transit, housing and food section.
    fetch('./extras.json').then((r) => (r.ok ? r.json() : null)).then((x) => x && setExtras(x), () => {})
  }, [])
  const areas = useMemo(() => data && scoreAreas(data), [data])
  const eq = useMemo(() => data && equity(data.byAreaType, data.lowIncome), [data])
  const saved = data?.savedAt && new Date(data.savedAt).toLocaleDateString()

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand"><a href="#home">Pulse</a></p>
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
        {tab === HOME && <Landing areas={areas} onFound={setHere} />}
        {data && tab === 0 && <><Finding e={eq} /><Tracker types={data.types} byAreaType={data.byAreaType} areas={areas} areaId={tid} /></>}
        {data && tab === 1 && <Ratings types={data.types} />}
        {data && tab === 2 && <Scorecard areas={areas} />}
        {data && tab === 3 && <HealthMap areas={areas} clinics={data.clinics} centers={centers} />}
        {data && tab === 4 && <Fairness data={data} areas={areas} e={eq} />}
        {data && pid && <Profile id={pid} areas={areas} eq={eq} clinics={data.clinics} centers={centers} wards={wards}
          point={here?.areaId === pid ? here.point : null} extras={extras} pop={data.pop?.[areas.find((x) => x.id === pid)?.name]} />}
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

// The bar in each row shows whatever the list is sorted by.
const SORTS = [
  ['n', 'Most requested', (t) => t.n],
  ['days', 'Slowest', (t) => t.days ?? -1],
  ['open', 'Most open', (t) => t.open / t.n],
]

// Average close time weighted by how many requests of each type were closed.
const avgClose = (rows) => {
  const closed = rows.filter((t) => t.days != null && t.n > t.open)
  const w = closed.reduce((s, t) => s + t.n - t.open, 0)
  return w ? closed.reduce((s, t) => s + t.days * (t.n - t.open), 0) / w : null
}
const signed = (d) => `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), 1)}`

// One plain sentence that says what the numbers mean for the view that's open.
function summary(rows, cityDays, name, avgDays) {
  if (!name) {
    const slow = [...rows].sort((a, b) => b.n - a.n).slice(0, 10).filter((t) => t.days != null).sort((a, b) => b.days - a.days)[0]
    return <>Across Chicago, requests take <strong>{fmt(avgDays, 1)} days</strong> to close. The slowest common one is {slow.sr_type}, at <strong>{fmt(slow.days, 1)} days</strong>.</>
  }
  // Only services with enough closed requests here to compare fairly.
  const cmp = rows.filter((t) => t.days != null && t.n - t.open >= 10 && cityDays[t.sr_type] != null)
    .map((t) => ({ ...t, diff: t.days - cityDays[t.sr_type] })).sort((a, b) => b.diff - a.diff)
  const worst = cmp[0]
  if (worst && worst.diff >= 1) {
    return <>In {name}, {worst.sr_type} takes <strong>{fmt(worst.days, 1)} days</strong> to close, <strong>{fmt(worst.diff, 1)} days longer</strong> than the city average.</>
  }
  return <>In {name}, common requests close about as fast as the rest of the city, or faster.</>
}

function Tracker({ types, byAreaType, areas, areaId }) {
  const [sort, setSort] = useState('n')
  const [all, setAll] = useState(false)
  const area = areaId && areas.find((a) => a.id === areaId)
  const name = area && title(area.name)
  const cityDays = Object.fromEntries(types.map((t) => [t.sr_type, t.days]))
  const cityAvg = avgClose(types)
  // In a neighborhood, skip types with only a handful of requests; they swing too much to rank.
  const scope = area ? byAreaType.filter((r) => r.community_area === area.id && r.n >= 5) : types
  const total = scope.reduce((s, t) => s + t.n, 0)
  const open = scope.reduce((s, t) => s + t.open, 0)
  const avgDays = area ? avgClose(scope) : cityAvg
  // Types closed within ~2 hours citywide are office paperwork (parking reviews, Divvy complaints), not
  // services residents wait on. Graffiti removal (~0.4 days) stays.
  const services = scope.filter((t) => cityDays[t.sr_type] == null || cityDays[t.sr_type] >= 0.1)
  const by = SORTS.find(([k]) => k === sort)[2]
  const sorted = [...services].sort((a, b) => by(b) - by(a)).slice(0, 20)
  const rows = all ? sorted : sorted.slice(0, 10)
  const max = Math.max(...sorted.map(by), 0) || 1
  const pick = (id) => { location.hash = id ? `#service-tracker/${id}` : '#service-tracker' }

  return (
    <>
      <label className="search">Neighborhood
        <select value={area?.id ?? ''} onChange={(e) => pick(e.target.value)}>
          <option value="">All of Chicago</option>
          {[...areas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => <option key={a.id} value={a.id}>{title(a.name)}</option>)}
        </select>
        {area && <a href={`#neighborhood/${area.id}`}>Full report →</a>}
      </label>
      {areaId && !area && <p className="muted">We couldn't find that neighborhood. Showing all of Chicago.</p>}
      {services.length > 0 && <p className="summary">{summary(services, cityDays, name, avgDays)}</p>}
      <div className="kpis">
        <Kpi label="Requests" value={fmt(total)} />
        <Kpi label="Still open" value={fmt(open)} note={pct(open / total)} />
        <Kpi label="Avg days to close" value={fmt(avgDays, 1)} note={area ? `City: ${fmt(cityAvg, 1)}` : null} />
      </div>
      <div className="list-head">
        <h2>Top services{name ? ` in ${name}` : ''}</h2>
        <div className="seg" role="group" aria-label="Sort services">
          {SORTS.map(([k, label]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
      </div>
      <ol className={area ? 'svc-list in-area' : 'svc-list'}>
        <li className="svc-cols" aria-hidden="true"><span /><span>Service</span><span /><span>Requests</span><span>Open</span><span>{area ? 'Days (vs city)' : 'Days'}</span></li>
        {rows.map((t, i) => {
          const diff = area && t.days != null && cityDays[t.sr_type] != null ? t.days - cityDays[t.sr_type] : null
          // In a neighborhood, "slow" means slower than the city for the same service.
          const slow = area ? diff != null && diff >= 0.5 : t.days != null && t.days > avgDays
          return (
            <li key={t.sr_type}>
              <span className="rank">{i + 1}</span>
              <b>{t.sr_type}</b>
              <span className="meter" aria-hidden="true"><span style={{ width: `${(Math.max(by(t), 0) / max) * 100}%` }} /></span>
              <span>{fmt(t.n)}<span className="lbl"> requests</span></span>
              <span><span className="lbl">Open </span>{pct(t.open / t.n)}</span>
              <span className={slow ? 'days slow' : 'days'}>
                {t.days == null ? '–' : fmt(t.days, 1)}<span className="lbl"> days</span>
                {diff != null && Math.abs(diff) >= 0.1 && <span className="diff" title="Compared with the city average for this service"> ({signed(diff)})</span>}
              </span>
            </li>
          )
        })}
      </ol>
      {!rows.length && <p className="muted">No requests here in the last {DAYS} days.</p>}
      {sorted.length > 10 && (
        <button className="btn more" onClick={() => setAll((v) => !v)}>{all ? 'Show top 10' : `Show all ${sorted.length}`}</button>
      )}
      <section className="act">
        <p>See a problem{name ? ` in ${name}` : ''}? A 311 request puts it on the record.</p>
        <a className="btn" href={CITY_311_URL} target="_blank" rel="noopener noreferrer">Report it to 311 →</a>
      </section>
      <Comments topic={`services/${area?.id ?? 'city'}`}
        question={name ? `Do these numbers match what you see in ${name}?` : 'Do these numbers match what you see?'} />
    </>
  )
}

const TIERS = { 5: 'Best rated', 4: 'Above average', 3: 'Middle of the pack', 2: 'Below average', 1: 'Lowest rated' }

function Ratings({ types }) {
  const rated = rateServices(types)
  const [votes, setVotes] = useState({})
  const [thanks, setThanks] = useState(null)
  useEffect(() => { allRatings().then(setVotes) }, [])
  const rate = async (type, n) => { setVotes(await addRating(type, n)); setThanks(type) }
  return (
    <>
      <p className="muted">The tier stars come from 311 speed and backlog. Under each service, add your own rating from 1 to 5. Resident ratings are saved on this device.</p>
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
                  <ResidentRating type={t.sr_type} votes={votes[t.sr_type]} onRate={rate} thanked={thanks === t.sr_type} />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

// Five tap targets; the line below shows the residents' average so far.
function ResidentRating({ type, votes = [], onRate, thanked }) {
  const avg = average(votes)
  return (
    <div className="rate">
      <div className="rate-stars" role="group" aria-label={`Your rating for ${type}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onRate(type, n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>
        ))}
      </div>
      <span className="muted small" role="status">
        {thanked ? 'Thanks! ' : ''}
        {avg == null ? 'No resident ratings yet' : `Residents: ${fmt(avg, 1)} ★ from ${votes.length} rating${votes.length > 1 ? 's' : ''}`}
      </span>
    </div>
  )
}

const AREA_SORTS = [
  ['best', 'Best first', (a, b) => b.score - a.score],
  ['worst', 'Worst first', (a, b) => a.score - b.score],
  ['az', 'A to Z', (a, b) => a.name.localeCompare(b.name)],
]

// One clickable card per neighborhood; each opens that neighborhood's report.
function Scorecard({ areas }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('best')
  const [all, setAll] = useState(false)
  const needle = q.trim().toUpperCase()
  const matches = areas.filter((a) => a.name.includes(needle)).sort(AREA_SORTS.find(([k]) => k === sort)[2])
  const shown = all || needle ? matches : matches.slice(0, 12)
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
      <div className="list-head">
        <label className="search">Filter <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Englewood" /></label>
        <div className="seg" role="group" aria-label="Sort neighborhoods">
          {AREA_SORTS.map(([k, label]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
      </div>
      {!shown.length && <p className="muted">No neighborhood matches "{q}".</p>}
      <ul className="cards area-cards">
        {shown.map((a) => (
          <li key={a.id}>
            <a className="card" href={`#neighborhood/${a.id}`}>
              <div className="area-head"><b>{title(a.name)}</b><span className={`grade g${a.grade}`} aria-label={`Grade ${a.grade}`}>{a.grade}</span></div>
              <dl>
                <div><dt>Open</dt><dd>{pct(a.openShare)}</dd></div>
                <div><dt>Avg days</dt><dd>{fmt(a.days, 1)}</dd></div>
                <div><dt>Clinic</dt><dd>{fmt(a.clinicKm, 1)} km</dd></div>
              </dl>
            </a>
          </li>
        ))}
      </ul>
      {!needle && matches.length > 12 && (
        <button className="btn more" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${matches.length}`}</button>
      )}
    </>
  )
}

// Plain words for an area's wait index (1 = city average for the same requests).
const vsAvg = (i) => (Math.abs(i - 1) < 0.03 ? 'about average' : `${pct(Math.abs(i - 1))} ${i > 1 ? 'longer' : 'shorter'}`)
// Full phrase: "8% shorter than average" / "about the same as average".
const vsAvgFull = (i) => (Math.abs(i - 1) < 0.03 ? 'about the same as average' : `${vsAvg(i)} than average`)
const dayWord = (d) => `${fmt(d, 1)} ${fmt(d, 1) === '1' ? 'day' : 'days'}`

// Who waits longer, told as a story: the answer, a plain comparison, examples, your neighborhood, the proof.
function Fairness({ data, areas, e }) {
  const [all, setAll] = useState(false)
  const [pick, setPick] = useState('')
  const names = Object.fromEntries(areas.map((a) => [a.id, title(a.name)]))
  const gap = e.poor / e.rich - 1
  const k = Math.max(1, Math.floor(e.areas.length / 5)) // same group size as equity()
  // The live number moves day to day, so the headline always says which 90 days it covers.
  const asOf = new Date(data.savedAt ?? Date.now()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const per10 = 10 * (e.poor / e.rich)
  const shown = all ? e.services : e.services.slice(0, 5)
  const maxDays = Math.max(...shown.map((x) => Math.max(x.poor, x.rich)))
  const byWait = [...e.areas].sort((a, b) => b.index - a.index)
  const mine = pick && e.areas.find((a) => a.id === pick)
  const rank = mine && byWait.findIndex((a) => a.id === pick) + 1

  return (
    <>
      <p className="headline">
        {gap > 0.05
          ? <>In Chicago's poorest neighborhoods, the same type of 311 request takes <strong>{pct(gap)} longer</strong> to close than in the richest.</>
          : <>The same type of 311 request takes about as long to close in poor neighborhoods as in rich ones.</>}
      </p>
      <p className="muted">90 days ending {asOf}.</p>

      <div className="compare" role="img" aria-label={`For every 10 days a richer neighborhood waits, a poorer one waits ${fmt(per10, 1)}.`}>
        <p>For every <strong>10 days</strong> a richer neighborhood waits, a poorer one waits <strong>{fmt(per10, 1)}</strong>.</p>
        <div className="pair"><span>{k} richest</span><span className="bar2"><span style={{ width: `${(10 / Math.max(10, per10)) * 100}%` }} /></span><b>10 days</b></div>
        <div className="pair poor"><span>{k} poorest</span><span className="bar2"><span style={{ width: `${(per10 / Math.max(10, per10)) * 100}%` }} /></span><b>{fmt(per10, 1)} days</b></div>
      </div>

      <h2>Where the gap is biggest</h2>
      <ul className="gaps">
        {shown.map((x) => (
          <li key={x.type}>
            <b>{x.type}</b>
            <div className="pair"><span>Richest</span><span className="bar2"><span style={{ width: `${(x.rich / maxDays) * 100}%` }} /></span><span>{dayWord(x.rich)}</span></div>
            <div className="pair poor"><span>Poorest</span><span className="bar2"><span style={{ width: `${(x.poor / maxDays) * 100}%` }} /></span><span>{dayWord(x.poor)}</span></div>
          </li>
        ))}
      </ul>
      {e.services.length > 5 && (
        <button className="btn more" onClick={() => setAll((v) => !v)}>{all ? 'Show top 5' : `Show all ${e.services.length}`}</button>
      )}

      <h2>Check your neighborhood</h2>
      <label className="search">Neighborhood
        <select value={pick} onChange={(ev) => setPick(ev.target.value)}>
          <option value="">Pick one</option>
          {[...e.areas].sort((a, b) => names[a.id].localeCompare(names[b.id])).map((a) => <option key={a.id} value={a.id}>{names[a.id]}</option>)}
        </select>
      </label>
      {mine && (
        <p className="summary">
          {names[mine.id]}'s waits are <strong>{vsAvgFull(mine.index)}</strong> for the same requests.
          It ranks <strong>#{rank}</strong> of {e.areas.length} for longest waits, and {pct(mine.low)} of its households earn under $25k.
          {' '}<a href={`#service-tracker/${mine.id}`}>See its services →</a>
        </p>
      )}

      <h2>Every neighborhood</h2>
      <p className="muted">Each dot is a neighborhood. Higher means a longer wait.</p>
      <Scatter points={e.areas.map((a) => ({ ...a, name: names[a.id] }))} rich={e.rich} poor={e.poor} k={k} />
      <details className="method">
        <summary>See as a table</summary>
        <table>
          <thead><tr><th>Neighborhood</th><th>Wait vs city average</th><th>Households under $25k</th></tr></thead>
          <tbody>
            {byWait.map((a) => (
              <tr key={a.id}><td>{names[a.id]}</td><td>{vsAvg(a.index)}</td><td>{pct(a.low)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
      <details className="method">
        <summary>How it's measured</summary>
        <ul>
          <li>Each neighborhood is compared with the city average for its own mix of requests. Same-day services are left out.</li>
          <li>Richest and poorest: the {k} neighborhoods with the smallest and largest share of households under $25k (Census).</li>
          <li>Closed tickets only, last {DAYS} days. Shows income and wait go together, not why.</li>
        </ul>
      </details>
      <Comments topic="who-waits-longer" question="Does this match what you see in your neighborhood?" />
    </>
  )
}

function Scatter({ points, rich, poor, k }) {
  const W = 640, H = 320, L = 64, R = 24, T = 24, B = 44
  const xs = points.map((p) => p.low), ys = points.map((p) => p.index)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const x = (v) => L + ((v - minX) / (maxX - minX)) * (W - L - R)
  const y = (v) => H - B - ((v - minY) / (maxY - minY)) * (H - T - B)
  // Same groups as equity(): sorted by low-income share.
  const sorted = [...points].sort((a, b) => a.low - b.low)
  const groups = [[sorted.slice(0, k), rich, `${k} richest`], [sorted.slice(-k), poor, `${k} poorest`]]
  const poorIds = new Set(sorted.slice(-k).map((p) => p.id))
  const byWait = [...points].sort((a, b) => b.index - a.index)
  const labeled = [byWait[0], byWait[1], byWait.at(-1)]
  const yTicks = [0.8, 1, 1.2, 1.4].filter((t) => t >= minY && t <= maxY)
  const tick = (t) => (t === 1 ? 'average' : `${t > 1 ? '+' : '−'}${pct(Math.abs(t - 1))}`)
  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scatter" role="img"
        aria-label={`Chart of ${points.length} neighborhoods. The ${k} poorest have waits ${vsAvgFull(poor)}; the ${k} richest, ${vsAvgFull(rich)}. The table below lists every neighborhood.`}>
        {/* Range-frame axes: lines span only the data. */}
        <line x1={x(minX)} x2={x(maxX)} y1={H - B + 8} y2={H - B + 8} className="axis" />
        <line x1={L - 8} x2={L - 8} y1={y(minY)} y2={y(maxY)} className="axis" />
        {[0.1, 0.2, 0.3, 0.4, 0.5].filter((t) => t >= minX && t <= maxX).map((t) => (
          <text key={t} x={x(t)} y={H - B + 24} textAnchor="middle">{pct(t)}</text>
        ))}
        {yTicks.map((t) => <text key={t} x={L - 14} y={y(t) + 4} textAnchor="end">{tick(t)}</text>)}
        <text x={L - 8} y={12} textAnchor="start">↑ Waits longer</text>
        <text x={W - R} y={H - 6} textAnchor="end">More low-income households →</text>
        <line x1={x(minX)} x2={x(maxX)} y1={y(1)} y2={y(1)} className="ref" />
        {points.map((p) => (
          <circle key={p.id} cx={x(p.low)} cy={y(p.index)} r="4.5" className={poorIds.has(p.id) ? 'hi' : undefined}>
            <title>{`${p.name}: waits ${vsAvgFull(p.index)}; ${pct(p.low)} of households under $25k`}</title>
          </circle>
        ))}
        {groups.map(([g, avg, label]) => {
          const [x1, x2] = [x(g[0].low), x(g.at(-1).low)]
          return (
            <g key={label} className="avg">
              <line x1={x1} x2={x2} y1={y(avg)} y2={y(avg)} />
              <text x={(x1 + x2) / 2} y={y(avg) + (avg > 1 ? -8 : 16)} textAnchor="middle">{label}: {vsAvg(avg)}</text>
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
