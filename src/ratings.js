// Resident star ratings, one list of 1-5 votes per service type.
// shortcut: kept in this browser only (localStorage), like comments.js; swap all() and add() for a shared
// database when ratings should pool across visitors. Both already return promises.
const KEY = 'ratings'

export async function all() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {} // private window or blocked storage: start empty rather than crash
  }
}

export async function add(type, stars) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('stars must be 1 to 5')
  const data = await all()
  data[type] = [...(Array.isArray(data[type]) ? data[type] : []), stars]
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* still shown until refresh */ }
  return data
}

export const average = (votes = []) => (votes.length ? votes.reduce((s, n) => s + n, 0) / votes.length : null)
