import { expect, test } from 'vitest'
import { pctRank, rateServices, km, centroid, gradeOf, scoreAreas, equity } from './score.js'
import { rollup } from './data.js'

test('pctRank', () => {
  expect(pctRank([1, 2, 3], 1)).toBe(0)
  expect(pctRank([1, 2, 3], 3)).toBe(1)
})

test('rateServices puts fast, mostly-closed services on top', () => {
  const r = rateServices([
    { sr_type: 'slow', n: 200, open: 150, days: 30 },
    { sr_type: 'fast', n: 200, open: 2, days: 1 },
    { sr_type: 'tiny', n: 5, open: 0, days: 0 },
  ])
  expect(r.map((t) => t.sr_type)).toEqual(['fast', 'slow'])
  expect(r[0].stars).toBe(5)
  expect(r[1].stars).toBe(1)
})

test('km: Loop to O\'Hare is about 26 km', () => {
  expect(km([41.8818, -87.6231], [41.9742, -87.9073])).toBeCloseTo(25.6, 0)
})

test('centroid of a square', () => {
  expect(centroid({ type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] })).toEqual([1, 1])
})

test('scoreAreas grades the area next to a clinic with a small backlog best', () => {
  const sq = (x) => ({ type: 'Polygon', coordinates: [[[x, 0], [x + 0.01, 0], [x + 0.01, 0.01], [x, 0.01]]] })
  const geo = { features: [
    { properties: { area_numbe: '1', community: 'GOOD' }, geometry: sq(0) },
    { properties: { area_numbe: '2', community: 'BAD' }, geometry: sq(1) },
  ] }
  const areas = { 1: { n: 100, open: 5, days: 2 }, 2: { n: 100, open: 60, days: 20 } }
  const r = scoreAreas({ geo, areas, clinics: [{ lat: 0.005, lng: 0.005 }], pop: { GOOD: 1000 } })
  expect(r.map((a) => [a.name, a.grade])).toEqual([['GOOD', 'A'], ['BAD', 'F']])
  expect(r[1].perK).toBeNull()
  // An area with no closed requests must not look fast.
  const none = scoreAreas({ geo, areas: { 1: areas[1] }, clinics: [{ lat: 0.005, lng: 0.005 }], pop: {} })
  expect(none.find((a) => a.name === 'BAD').days).toBe(Infinity)
  expect(gradeOf(0.5)).toBe('C')
})

test('rollup averages days over closed requests only', () => {
  const r = rollup([
    { k: 'a', n: 10, open: 0, days: 2 },
    { k: 'a', n: 10, open: 5, days: 8 },
    { k: 'a', n: 3, open: 3, days: null },
  ], 'k')
  expect(r).toEqual([{ k: 'a', n: 23, open: 8, days: 4 }])
})

test('equity: poorer areas waiting twice as long shows up, request mix does not', () => {
  const rows = []
  const low = {}
  for (let i = 0; i < 50; i++) {
    const id = String(i)
    low[id] = i / 50
    const slow = i >= 25 ? 2 : 1
    rows.push({ community_area: id, sr_type: 'potholes', n: 40, open: 0, days: 10 }) // same everywhere
    rows.push({ community_area: id, sr_type: 'dumping', n: 40, open: 0, days: 3 * slow })
    // Poor areas also file more of a slow service; that alone must not count against them.
    if (i >= 30) rows.push({ community_area: id, sr_type: 'buildings', n: 40, open: 0, days: 30 })
    // Too few closed requests per area to trust a per-service gap.
    rows.push({ community_area: id, sr_type: 'rare', n: 5, open: 0, days: 1 + 50 * slow })
  }
  const e = equity(rows, low)
  expect(e.poor).toBeGreaterThan(e.rich)
  expect(e.services.map((s) => s.type)).toEqual(['dumping', 'potholes'])
  expect(e.services[0].poor / e.services[0].rich).toBe(2)
  const mixOnly = equity(rows.filter((r) => !['dumping', 'rare'].includes(r.sr_type)), low)
  expect(mixOnly.poor).toBeCloseTo(1)
  expect(mixOnly.rich).toBeCloseTo(1)
})
