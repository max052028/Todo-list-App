import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { headers } from '../lib/api'

export default function Lists() {
  const [lists, setLists] = useState<any[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#0ea5e9')
  const [joinInput, setJoinInput] = useState('')
  const [joinMsg, setJoinMsg] = useState<string | null>(null)

  const load = async () => {
  const res = await fetch('/api/lists', { headers: headers() })
    setLists(await res.json())
  }

  useEffect(() => { load() }, [])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
  await fetch('/api/lists', { method: 'POST', headers: headers(), body: JSON.stringify({ name, color }) })
    setName('')
    load()
  }

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    const raw = joinInput.trim()
    if (!raw) return
    const tokenMatch = raw.match(/(?:join\/)?.*?([a-f0-9]{32})$/i)
    const token = tokenMatch ? tokenMatch[1] : raw
    const res = await fetch(`/api/join/${token}`, { method: 'POST', headers: headers() })
    if (res.ok) {
      setJoinMsg('已加入清單')
      setJoinInput('')
      load()
    } else {
      const err = await res.json().catch(()=>({error:'加入失敗'}))
      setJoinMsg(err.error || '加入失敗')
    }
  }

  return (
    <main>
      <h2>My Lists</h2>
      <form onSubmit={onCreate} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="New list name" />
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} />
        <button type="submit">Create</button>
      </form>
      <form onSubmit={onJoin} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={joinInput} onChange={e=>setJoinInput(e.target.value)} placeholder="Paste invite URL or token" />
        <button type="submit">Join</button>
        {joinMsg && <span style={{ marginLeft: 8, opacity: 0.7 }}>{joinMsg}</span>}
      </form>
      <ul>
        {lists.map(l => (
          <li key={l.id}>
            <Link to={`/lists/${l.id}`}>{l.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
