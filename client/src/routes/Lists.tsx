import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { headers, fetchWithCreds } from '../lib/api'

export default function Lists() {
  const [lists, setLists] = useState<any[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#0ea5e9')
  const [joinInput, setJoinInput] = useState('')
  const [joinMsg, setJoinMsg] = useState<string | null>(null)
  const [globalTasks, setGlobalTasks] = useState<any[]>([])
  const listNameById = useMemo(() => Object.fromEntries(lists.map(l => [l.id, l.name])), [lists])

  const load = async () => {
    const res = await fetchWithCreds('/api/lists', { headers: headers() })
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) setLists(data)
  }

  useEffect(() => { load() }, [])

  useEffect(() => { (async()=>{ const r = await fetchWithCreds('/api/tasks', { headers: headers() }); if (r.ok) setGlobalTasks(await r.json()) })() }, [])

  const grouped = useMemo(()=>({
    todo: globalTasks.filter(t=>t.status==='todo'),
    done: globalTasks.filter(t=>t.status==='done'),
  }), [globalTasks])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
  await fetchWithCreds('/api/lists', { method: 'POST', headers: headers(), body: JSON.stringify({ name, color }) })
    setName('')
  load()
  window.dispatchEvent(new Event('lists:changed'))
  }

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    const raw = joinInput.trim()
    if (!raw) return
    const tokenMatch = raw.match(/(?:join\/)?.*?([a-f0-9]{32})$/i)
    const token = tokenMatch ? tokenMatch[1] : raw
  const res = await fetchWithCreds(`/api/join/${token}`, { method: 'POST', headers: headers() })
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
    <main className="container" style={{ display: 'grid', gap: 16 }}>
      <section className="card card-pad" style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>我的任務</h2>
        <div className="muted">快速查看所有清單中的任務</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {[...grouped.todo, ...grouped.done].slice(0, 8).map(t => (
            <div key={t.id} className="card card-pad" style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div className="muted">狀態：{t.status}</div>
        <div className="muted">清單：{listNameById[t.listId] || t.listId}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-pad" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>我的清單</h2>
        <form onSubmit={onCreate} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="New list name" />
          <input className="input" type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ width: 56, padding: 4 }} />
          <button className="btn btn-primary" type="submit">Create</button>
        </form>
        <form onSubmit={onJoin} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" value={joinInput} onChange={e=>setJoinInput(e.target.value)} placeholder="Paste invite URL or token" />
          <button className="btn" type="submit">Join</button>
          {joinMsg && <span className="muted" style={{ marginLeft: 8 }}>{joinMsg}</span>}
        </form>
        <ul style={{ display: 'grid', gap: 6 }}>
          {lists.map(l => (
            <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: l.color || '#e5e7eb', border: '1px solid #d1d5db' }} />
              <Link to={`/lists/${l.id}`}>{l.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
