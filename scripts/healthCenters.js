// Saves Chicago's federally funded community health centers to public/health-centers.json.
// Source: HRSA's national site list (updated daily). These centers must serve everyone,
// with a sliding fee down to $0 for people who can't pay.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const URL_CSV = 'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv'

export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') field += c
      else if (text[i + 1] === '"') { field += '"'; i++ }
      else quoted = false
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

// Only links that are really web pages; never let file text become a javascript: URL.
const webUrl = (s) => {
  const u = s.trim() && (/^https?:\/\//i.test(s.trim()) ? s.trim() : `https://${s.trim()}`)
  return u && /^https?:\/\/[\w.-]+\.[a-z]{2,}/i.test(u) ? u : null
}

// Walk-in clinics for the public: active, permanent, sees patients, not school-only.
export function healthCenters(csvText) {
  const [head, ...rows] = parseCsv(csvText.replace(/^﻿/, ''))
  const col = Object.fromEntries(head.map((h, i) => [h, i]))
  const get = (r, k) => (r[col[k]] ?? '').trim()
  const seen = new Set()
  return rows
    .filter((r) => get(r, 'Site City').toLowerCase() === 'chicago' && get(r, 'Site State Abbreviation') === 'IL'
      && get(r, 'Site Status Description') === 'Active'
      && get(r, 'Health Center Location Type Description') === 'Permanent'
      && get(r, 'Health Center Type Description') !== 'Administrative'
      && get(r, 'Health Center Service Delivery Site Location Setting Description') !== 'School')
    .map((r) => ({
      name: get(r, 'Site Name'),
      org: get(r, 'Health Center Name'),
      address: get(r, 'Site Address'),
      zip: get(r, 'Site Postal Code').slice(0, 5),
      phone: get(r, 'Site Telephone Number'),
      web: webUrl(get(r, 'Site Web Address')),
      hours: +get(r, 'Operating Hours per Week') || null,
      lat: +get(r, 'Geocoding Artifact Address Primary Y Coordinate'),
      lng: +get(r, 'Geocoding Artifact Address Primary X Coordinate'),
    }))
    .filter((c) => c.lat && c.lng && !seen.has(c.name + c.address) && seen.add(c.name + c.address))
    .sort((a, b) => a.name.localeCompare(b.name))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = await fetch(URL_CSV)
  if (!res.ok) throw new Error(`HRSA download failed: HTTP ${res.status}`)
  const list = healthCenters(await res.text())
  if (list.length < 50) throw new Error(`only ${list.length} Chicago health centers found; HRSA file format may have changed`)
  writeFileSync(new URL('../public/health-centers.json', import.meta.url), JSON.stringify({ savedAt: new Date().toISOString(), list }))
  console.log(`saved ${list.length} health centers to public/health-centers.json`)
}
