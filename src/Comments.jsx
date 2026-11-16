import { useEffect, useState } from 'react'
import { list, add, MAX_LEN } from './comments.js'

const STANCES = [['agree', 'Agree'], ['unsure', 'Not sure'], ['disagree', 'Disagree']]
const LABEL = Object.fromEntries(STANCES)

// "Your take": a quick agree / not sure / disagree vote plus an optional comment, on one topic.
export default function Comments({ topic, question }) {
  const [items, setItems] = useState([])
  const [stance, setStance] = useState(null)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => { setSent(false); setStance(null); setText(''); list(topic).then(setItems) }, [topic])

  const submit = async (e) => {
    e.preventDefault()
    if (!stance) return
    setItems(await add(topic, { name, stance, text }))
    setText(''); setStance(null); setSent(true)
  }
  const count = (k) => items.filter((c) => c.stance === k).length
  const shown = items.filter((c) => c.text)

  return (
    <section className="comments" aria-labelledby={`c-${topic}`}>
      <h2 id={`c-${topic}`}>Your take</h2>
      <p className="muted">{question}</p>
      <form onSubmit={submit}>
        <div className="seg" role="group" aria-label="Your opinion">
          {STANCES.map(([k, label]) => (
            <button type="button" key={k} aria-pressed={stance === k} onClick={() => { setStance(k); setSent(false) }}>
              {label}{items.length > 0 && <span className="tally">{count(k)}</span>}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_LEN} rows={3}
          placeholder="What have you seen? (optional)" aria-label="Your comment" />
        <div className="comment-row">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="First name (optional)" aria-label="Your name" />
          <button className="btn" type="submit" disabled={!stance}>Post</button>
        </div>
        <p className="muted small" role="status">
          {sent ? 'Thanks, your take is posted.' : !stance ? 'Pick one to post.' : 'No health or personal details, please.'}
        </p>
      </form>
      {shown.length > 0 && (
        <ul className="comment-list">
          {shown.slice(0, 20).map((c) => (
            <li key={c.id}>
              <div><b>{c.name}</b> <span className={`stance ${c.stance}`}>{LABEL[c.stance]}</span>
                <span className="muted small"> · {new Date(c.at).toLocaleDateString()}</span></div>
              <p>{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
