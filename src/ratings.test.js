import { test, expect, beforeEach } from 'vitest'
import { all, add, average } from './ratings.js'

beforeEach(() => {
  const store = {}
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v } }
})

test('add keeps every vote per service and average uses them all', async () => {
  await add('Pothole', 2)
  const data = await add('Pothole', 5)
  expect(data.Pothole).toEqual([2, 5])
  expect(average(data.Pothole)).toBe(3.5)
  expect(average((await all())['Street Light'])).toBe(null)
})

test('add rejects anything but a whole 1-5 star vote', async () => {
  await expect(add('Pothole', 0)).rejects.toThrow()
  await expect(add('Pothole', 4.5)).rejects.toThrow()
})
