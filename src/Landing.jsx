import { ArrowRight, ClipboardList, Star, LayoutGrid, MapPin, Scale, Box } from 'lucide-react'
import NeighborhoodSearch from './NeighborhoodSearch.jsx'

// The front door. It shows no numbers: everything here is a way to ask for the data you want.
const DOORS = [
  [MapPin, 'Find free or low-cost care', 'Clinics near you, with hours, phone and directions.', '#health-access-map'],
  [ClipboardList, 'How fast does 311 respond?', 'What people report to the city and how quickly it gets closed.', '#service-tracker'],
  [LayoutGrid, 'Grade every neighborhood', 'See how all 77 neighborhoods compare on city service.', '#neighborhood-scorecard'],
  [Scale, 'Does income change the wait?', 'Whether the same request takes longer in some neighborhoods.', '#who-waits-longer'],
  [Star, 'Rate the city services', 'Stars for each kind of service, from best to worst.', '#service-ratings'],
  [Box, 'See it in 3D', 'Wait times raised into a spinning model of the city.', '#3d-skyline'],
]

export default function Landing({ areas }) {
  return (
    <>
      <section className="landing-hero">
        <h1>How well is Chicago serving you?</h1>
        <p className="lede">Look up your neighborhood to see how the city treats its 311 requests, how close free care is, and how the wait compares. Pick what you want to see; nothing else gets in the way.</p>
        <div className="landing-search">
          {areas
            ? <NeighborhoodSearch areas={areas} large />
            : <input type="search" disabled aria-label="Find a neighborhood" placeholder="Loading neighborhoods…" />}
        </div>
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
      <p className="muted small">Built from Chicago's public 311 records, census income data and federal clinic listings. Grades compare neighborhoods with each other; they rate the city's service, not the people who live there.</p>
    </>
  )
}
