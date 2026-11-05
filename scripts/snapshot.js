// Saves today's portal data to public/snapshot.json so the app can show it instantly when the portal is slow or down.
import { writeFileSync } from 'node:fs'
import { loadAll } from '../src/data.js'

const data = await loadAll()
const file = new URL('../public/snapshot.json', import.meta.url)
writeFileSync(file, JSON.stringify({ ...data, savedAt: new Date().toISOString() }))
console.log(`saved ${data.byAreaType.length} rows to public/snapshot.json`)
