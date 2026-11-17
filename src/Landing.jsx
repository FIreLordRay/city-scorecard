import { ArrowRight, ClipboardList, Star, LayoutGrid, MapPin, Scale } from 'lucide-react'
import NeighborhoodSearch from './NeighborhoodSearch.jsx'
import { useState } from 'react'
import { lookupAddress } from './AddressSearch.jsx'
import CityMap from './CityMap.jsx'

// The front door: a map of every neighborhood's grade, a search box, and doors to each question.
const DOORS = [
  [MapPin, 'Find free or low-cost care', 'Clinics, hours and directions.', '#health-access-map'],
  [ClipboardList, 'How fast does 311 respond?', 'Requests and close times.', '#service-tracker'],
  [LayoutGrid, 'Grade every neighborhood', 'All 77, from A to F.', '#neighborhood-scorecard'],
  [Scale, 'Does income change the wait?', 'Same request, different waits.', '#who-waits-longer'],
  [Star, 'How each service rates', 'Stars from 311 speed and backlog, best to worst.', '#service-ratings'],
]

export default function Landing({ areas, onFound }) {
  const [msg, setMsg] = useState('')

  async function findAddress(text) {
    setMsg('Finding that address…')
    try {
      const hit = await lookupAddress(areas, text)
      if (!hit) return setMsg("Couldn't find that address in Chicago. Try adding the street type (Ave, St), or type a neighborhood name.")
      setMsg('')
      onFound({ areaId: hit.area.id, point: hit.point })
      location.hash = `#neighborhood/${hit.area.id}`
    } catch {
      setMsg("Address search isn't reachable right now. Type a neighborhood name instead.")
    }
  }

  return (
    <div className="landing">
      {areas && <CityMap areas={areas} legend className="hero-map" />}
      <section className="landing-hero">
        <h1>One city. Different people. Same Pulse?</h1>
        <p className="lede">How well is Chicago serving your neighborhood? Look it up, or pick a question.</p>
        <div className="landing-search">
          {areas
            ? <NeighborhoodSearch areas={areas} large onAddress={findAddress} placeholder="Neighborhood or address" />
            : <input type="search" disabled aria-label="Find a neighborhood" placeholder="Loading neighborhoods…" />}
        </div>
        {msg && <p role="status" className="note">{msg}</p>}
        <p className="muted small-note">An address also shows your ward and the care closest to your door. It goes to OpenStreetMap's search to find it on the map, isn't saved, and shared links only name the neighborhood.</p>
      </section>
      <h2 className="visually-hidden">Or start with a question</h2>
      <ul className="doors">
        {DOORS.map(([Icon, label, text, href]) => (
          <li key={href}>
            <a href={href}>
              <Icon size={22} aria-hidden="true" />
              <b>{label}</b>
              <span className="muted">{text}</span>
              <ArrowRight className="go" size={18} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      <p className="muted small">Grades rate the city's service, not the people who live there.</p>
    </div>
  )
}
