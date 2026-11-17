import { expect, test } from 'vitest'
import { displayName } from './wards.js'

test('displayName flips "Last, First" and leaves other names alone', () => {
  expect(displayName('La Spata, Daniel')).toBe('Daniel La Spata')
  expect(displayName('Taylor, Jeanette B.')).toBe('Jeanette B. Taylor')
  expect(displayName('Vacant')).toBe('Vacant')
  expect(displayName(undefined)).toBe('')
})
