import { ArrowRight, ClipboardList, Star, LayoutGrid, MapPin, Scale } from 'lucide-react'
import NeighborhoodSearch from './NeighborhoodSearch.jsx'
import AddressSearch from './AddressSearch.jsx'

// The front door. It shows no numbers: everything here is a way to ask for the data you want.
const DOORS = [
  [MapPin, 'Find free or low-cost care', 'Clinics, hours and directions.', '#health-access-map'],
  [ClipboardList, 'How fast does 311 respond?', 'Requests and close times.', '#service-tracker'],
  [LayoutGrid, 'Grade every neighborhood', 'All 77, from A to F.', '#neighborhood-scorecard'],
  [Scale, 'Does income change the wait?', 'Same request, different waits.', '#who-waits-longer'],
  [Star, 'Rate the city services', 'Best to worst.', '#service-ratings'],
]

export default function Landing({ areas, onFound }) {
  return (
    <>
      <section className="landing-hero">
        <h1>One city. Different people. Same Pulse?</h1>
        <p className="lede">How well is Chicago serving your neighborhood? Look it up, or pick a question.</p>
        <div className="landing-search">
          {areas
            ? <NeighborhoodSearch areas={areas} large />
            : <input type="search" disabled aria-label="Find a neighborhood" placeholder="Loading neighborhoods…" />}
        </div>
        {areas && <AddressSearch areas={areas} onFound={onFound} />}
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
    </>
  )
}
