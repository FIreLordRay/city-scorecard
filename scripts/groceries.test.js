import { test, expect } from 'vitest'
import { groceryStores, snapStores } from './groceries.js'

test('one grocery store per license, from its latest inspection, closed ones dropped', () => {
  const row = (license_, inspection_date, results, extra = {}) => ({ license_, inspection_date, results, dba_name: 'SHOP ' + license_, address: '1 W MAIN ST ', latitude: '41.9', longitude: '-87.6', ...extra })
  const out = groceryStores([
    row('1', '2025-01-01T00:00:00.000', 'Fail'),
    row('1', '2026-01-01T00:00:00.000', 'Pass'),
    row('2', '2026-01-01T00:00:00.000', 'Out of Business'),
    row('2', '2025-01-01T00:00:00.000', 'Pass'),
    row('3', '2026-01-01T00:00:00.000', 'Pass', { latitude: undefined }),
  ])
  expect(out).toEqual([{ name: 'SHOP 1', address: '1 W MAIN ST', zip: '', lat: 41.9, lng: -87.6 }])
})

test('SNAP stores keep their type and skip restaurants', () => {
  const a = (Store_Type, Latitude = 41.8) => ({ Store_Name: 'X ', Store_Street_Address: '2 S State St', Zip_Code: '60603', Store_Type, Latitude, Longitude: -87.6 })
  const out = snapStores([{ ...a('Supermarket'), Store_Name: 'X 62092 62092' }, a('Restaurant Meals Program'), a('Convenience Store', null)])
  expect(out).toEqual([{ name: 'X', address: '2 S State St', zip: '60603', lat: 41.8, lng: -87.6, type: 'Supermarket' }])
})
