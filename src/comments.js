// Where comments are kept. For now that's this browser only (localStorage), so the demo works with no
// server. To share comments between visitors, swap these two functions for calls to a real database;
// the Comments component only uses list() and add(), and both already return promises.
const KEY = (topic) => `comments:${topic}`
export const MAX_LEN = 500

export async function list(topic) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY(topic)) ?? '[]')
    return Array.isArray(all) ? all : []
  } catch {
    return [] // private window or blocked storage: show an empty wall rather than crash
  }
}

export async function add(topic, { name, stance, text }) {
  const entry = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    name: name.trim().slice(0, 40) || 'Neighbor',
    stance,
    text: text.trim().slice(0, MAX_LEN),
    at: new Date().toISOString(),
  }
  const all = [entry, ...(await list(topic))]
  try { localStorage.setItem(KEY(topic), JSON.stringify(all)) } catch { /* still shown until refresh */ }
  return all
}
