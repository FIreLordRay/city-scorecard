// All data comes live from the Chicago Data Portal (Socrata SoQL), no key needed.
const API = 'https://data.cityofchicago.org/resource'
export const DAYS = 90
const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10)
// Info-only calls, airport noise and discontinued services close instantly and would fake great service.
const WHERE = `created_date > '${since}' AND duplicate=false AND status != 'Canceled' AND sr_type not in('311 INFORMATION ONLY CALL','Aircraft Noise Complaint') AND upper(sr_type) not like '%NO LONGER%'`
const STATS = "count(*) as n, sum(case(status='Open',1,true,0)) as open, avg(date_diff_d(closed_date,created_date)) as days"
const INCOME_BINS = ['under_25_000', '_25_000_to_49_999', '_50_000_to_74_999', '_75_000_to_125_000', '_125_000']

async function soql(id, params, ext = 'json') {
  const res = await fetch(`${API}/${id}.${ext}?` + new URLSearchParams(params))
  if (!res.ok) throw new Error(`Chicago Data Portal ${id}: HTTP ${res.status}`)
  return res.json()
}

// Sum rows that share a key; days is averaged over closed requests only, matching the SoQL avg.
export function rollup(rows, key) {
  const out = {}
  for (const r of rows) {
    const s = (out[r[key]] ??= { [key]: r[key], n: 0, open: 0, dayTotal: 0, closed: 0 })
    s.n += r.n
    s.open += r.open
    if (r.days != null) { s.dayTotal += r.days * (r.n - r.open); s.closed += r.n - r.open }
  }
  return Object.values(out).map(({ dayTotal, closed, ...s }) => ({ ...s, days: closed ? dayTotal / closed : null }))
}

export async function loadAll() {
  const [raw, clinics, geo, acs] = await Promise.all([
    soql('v6vf-nfxy', { $select: `community_area, sr_type, ${STATS}`, $where: WHERE, $group: 'community_area,sr_type', $limit: 50000 }),
    soql('kcki-hnch', { $limit: 100 }),
    soql('igwz-8jzy', { $limit: 100 }, 'geojson'),
    soql('t68z-cikk', { $select: ['community_area', 'total_population', ...INCOME_BINS].join(), $order: 'acs_year', $limit: 1000 }),
  ])
  if (!raw.length) throw new Error('the portal returned no 311 data')
  const byAreaType = raw
    .filter((r) => r.community_area)
    .map((r) => ({ ...r, n: +r.n, open: +r.open, days: r.days == null ? null : +r.days }))
  const pop = Object.fromEntries(acs.map((r) => [r.community_area, +r.total_population]))
  const lowByName = Object.fromEntries(acs.map((r) => [
    r.community_area,
    +r.under_25_000 / INCOME_BINS.reduce((s, b) => s + +r[b], 0),
  ]))
  // Share of households under $25k, keyed by area number like the 311 rows.
  const lowIncome = Object.fromEntries(geo.features.map(({ properties: p }) => [p.area_numbe, lowByName[p.community]]))
  return {
    byAreaType,
    types: rollup(byAreaType, 'sr_type').sort((a, b) => b.n - a.n),
    areas: Object.fromEntries(rollup(byAreaType, 'community_area').map((r) => [r.community_area, r])),
    clinics: clinics.filter((c) => c.latitude).map((c) => ({ ...c, lat: +c.latitude, lng: +c.longitude })),
    geo,
    pop,
    lowIncome,
  }
}
