import { useMemo } from 'react'
import { title } from './score.js'

const W = 300  // viewBox width; height follows Chicago's shape
const GRADES = ['A', 'B', 'C', 'D', 'F']

// All 77 neighborhoods as one SVG, each filled by its grade. Drawn straight from the boundary data, no map tiles.
// `highlight` (an area id) dims the rest, for "you are here" on a report. Tapping an area opens its report;
// keyboard and screen-reader users have the search box for the same thing, so the map stays out of the tab order.
export default function CityMap({ areas, highlight = null, legend = false, className = '' }) {
  const { shapes, h } = useMemo(() => {
    const rings = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat()
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity]
    for (const a of areas) for (const r of rings(a.feature.geometry)) for (const [x, y] of r) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180) // longitude degrees shrink with latitude
    const s = W / ((x1 - x0) * k)
    const shapes = areas.map((a) => ({
      id: a.id, grade: a.grade, name: title(a.name),
      d: rings(a.feature.geometry).map((r) => 'M' + r.map(([x, y]) => `${((x - x0) * k * s).toFixed(1)},${((y1 - y) * s).toFixed(1)}`).join('L') + 'Z').join(''),
    }))
    return { shapes, h: Math.ceil((y1 - y0) * s) }
  }, [areas])

  return (
    <figure className={`citymap ${className}`}>
      <svg viewBox={`0 0 ${W} ${h}`} aria-hidden="true" focusable="false">
        {/* The highlighted area goes last so its outline isn't hidden under its neighbors. */}
        {[...shapes].sort((a, b) => (a.id === highlight) - (b.id === highlight)).map((p) => (
          <a key={p.id} href={`#neighborhood/${p.id}`} tabIndex={-1}>
            <path d={p.d} className={`fill${p.grade}${highlight && p.id !== highlight ? ' dim' : ''}${p.id === highlight ? ' here' : ''}`}>
              <title>{`${p.name}: ${p.grade}`}</title>
            </path>
          </a>
        ))}
      </svg>
      {legend && (
        <figcaption>
          {GRADES.map((g) => <span key={g}><i className={`fill${g}`} />{g}</span>)}
          <span className="muted">Tap a neighborhood</span>
        </figcaption>
      )}
    </figure>
  )
}
