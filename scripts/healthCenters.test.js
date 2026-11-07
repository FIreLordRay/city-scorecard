import { expect, test } from 'vitest'
import { parseCsv, healthCenters } from './healthCenters.js'

test('parseCsv handles quotes, escaped quotes, commas and CRLF', () => {
  expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3')).toEqual([['a', 'b, c', 'say "hi"'], ['1', '2', '3']])
})

const HEAD = ['Site Name', 'Health Center Name', 'Site Address', 'Site City', 'Site State Abbreviation', 'Site Postal Code',
  'Site Telephone Number', 'Site Web Address', 'Operating Hours per Week', 'Site Status Description',
  'Health Center Location Type Description', 'Health Center Type Description',
  'Health Center Service Delivery Site Location Setting Description',
  'Geocoding Artifact Address Primary Y Coordinate', 'Geocoding Artifact Address Primary X Coordinate']
const row = (o) => HEAD.map((h) => `"${o[h] ?? ''}"`).join(',')
const base = { 'Site Name': 'Clinic A', 'Site Address': '1 Main St', 'Site City': 'Chicago', 'Site State Abbreviation': 'IL',
  'Site Postal Code': '60624-1723', 'Site Web Address': 'www.example.org', 'Operating Hours per Week': '40.00',
  'Site Status Description': 'Active', 'Health Center Location Type Description': 'Permanent',
  'Health Center Type Description': 'Service Delivery Site',
  'Health Center Service Delivery Site Location Setting Description': 'All Other Clinic Types',
  'Geocoding Artifact Address Primary Y Coordinate': '41.88', 'Geocoding Artifact Address Primary X Coordinate': '-87.73' }

test('healthCenters keeps public walk-in clinics and drops the rest', () => {
  const csv = '﻿' + [HEAD.map((h) => `"${h}"`).join(','),
    row(base),
    row(base), // duplicate
    row({ ...base, 'Site Name': 'School clinic', 'Health Center Service Delivery Site Location Setting Description': 'School' }),
    row({ ...base, 'Site Name': 'Van', 'Health Center Location Type Description': 'Mobile Van' }),
    row({ ...base, 'Site Name': 'Office', 'Health Center Type Description': 'Administrative' }),
    row({ ...base, 'Site Name': 'Suburb', 'Site City': 'Oak Park' }),
    row({ ...base, 'Site Name': 'Bad link', 'Site Web Address': 'javascript:alert(1)' }),
  ].join('\n')
  const out = healthCenters(csv)
  expect(out.map((c) => c.name)).toEqual(['Bad link', 'Clinic A'])
  expect(out[1]).toMatchObject({ zip: '60624', web: 'https://www.example.org', hours: 40, lat: 41.88, lng: -87.73 })
  expect(out[0].web).toBe(null)
})
