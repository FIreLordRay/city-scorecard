import { useId, useMemo, useRef, useState } from 'react'
import { title } from './score.js'

// Type a few letters, pick a neighborhood, land on its report. Follows the ARIA combobox pattern.
// With `onAddress`, text that starts with a number or matches no neighborhood is looked up as an address on Enter.
export default function NeighborhoodSearch({ areas, large = false, onAddress, placeholder = 'Find a neighborhood' }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const input = useRef(null)
  const needle = q.trim().toLowerCase()
  const results = useMemo(() => {
    if (!needle) return []
    const all = areas.map((a) => ({ id: a.id, name: title(a.name), grade: a.grade }))
    // Names that start with the text come first, then names that merely contain it.
    return [...all.filter((a) => a.name.toLowerCase().startsWith(needle)), ...all.filter((a) => !a.name.toLowerCase().startsWith(needle) && a.name.toLowerCase().includes(needle))].slice(0, 8)
  }, [areas, needle])
  const asAddress = onAddress && needle && (/^\d/.test(needle) || results.length === 0)

  const go = (r) => {
    if (!r) return
    location.hash = `#neighborhood/${r.id}`
    setQ('')
    setOpen(false)
    input.current?.blur()
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (asAddress) { setOpen(false); onAddress(q.trim()) } else go(results[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div className={large ? 'nsearch large' : 'nsearch'}>
      <label htmlFor={`${listId}-in`} className="visually-hidden">Find a neighborhood</label>
      <input
        id={`${listId}-in`} ref={input} type="search" role="combobox" autoComplete="off"
        aria-expanded={open && results.length > 0} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
        placeholder={placeholder} value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey}
      />
      {open && needle && (
        <ul id={listId} role="listbox" aria-label="Neighborhoods">
          {asAddress && <li className="none muted" role="option" aria-disabled="true" aria-selected="false">Press Enter to look up "{q.trim()}" as an address</li>}
          {results.length === 0 && !onAddress && <li className="none muted" role="option" aria-disabled="true" aria-selected="false">No neighborhood matches "{q}".</li>}
          {results.map((r, i) => (
            <li key={r.id} id={`${listId}-${r.id}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(r) }} onMouseEnter={() => setActive(i)}>
              {r.name}<span className={`grade g${r.grade}`}>{r.grade}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
