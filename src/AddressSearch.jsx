import { useState } from 'react'
import { contains } from './score.js'

const SEARCH = 'https://nominatim.openstreetmap.org/search'
const BOX = '-87.94,42.03,-87.52,41.64'   // Chicago's bounding box, so "Main St" finds the Chicago one

async function geocode(text) {
  const params = new URLSearchParams({ q: `${text}, Chicago, IL`, format: 'jsonv2', limit: 1, viewbox: BOX, bounded: 1 })
  const res = await fetch(`${SEARCH}?${params}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`address search failed (HTTP ${res.status})`)
  const [hit] = await res.json()
  return hit && [+hit.lon, +hit.lat]
}

// Type an address, land on that neighborhood's report. The point stays in memory only (onFound), so the URL
// and anything shared from it name the neighborhood, never the address.
export default function AddressSearch({ areas, onFound }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function find(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setMsg('')
    try {
      const point = await geocode(text.trim())
      const area = point && areas.find((a) => contains(a.feature.geometry, point))
      if (!area) return setMsg("Couldn't find that address in Chicago. Try adding the street type (Ave, St), or search by neighborhood.")
      onFound({ areaId: area.id, point })
      location.hash = `#neighborhood/${area.id}`
    } catch {
      setMsg("Address search isn't reachable right now. Search by neighborhood instead.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="lookup" onSubmit={find}>
      <label htmlFor="address">Or use your address, to see your ward and the care closest to your door</label>
      <div className="lookup-row">
        <input id="address" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 1234 W 63rd St" autoComplete="street-address" />
        <button type="submit" disabled={busy}>{busy ? 'Finding…' : 'Find my block'}</button>
      </div>
      <p className="muted small-note">Your address goes to OpenStreetMap's search to find it on the map. It isn't saved, and links you share only name the neighborhood.</p>
      {msg && <p role="status" className="note">{msg}</p>}
    </form>
  )
}
