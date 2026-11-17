import { test, expect } from 'vitest'
import { areaOf, VERDICTS } from './extras.js'

const square = (id, x) => ({ properties: { area_numbe: id }, geometry: { type: 'Polygon', coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] } })

test('areaOf places a point in its neighborhood, or nowhere', () => {
  const features = [square('1', 0), square('2', 1)]
  expect(areaOf(features, 1.5, 0.5)).toBe('2')
  expect(areaOf(features, 5, 5)).toBe(null)
  expect(areaOf(features, NaN, 0.5)).toBe(null) // inspections with no location
})

test('only real verdicts count toward the fail rate', () => {
  expect(VERDICTS.has('Fail')).toBe(true)
  expect(VERDICTS.has('Out of Business')).toBe(false)
})
