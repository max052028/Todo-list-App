import { Link, Outlet, NavLink } from 'react-router-dom'
import { getUserId, setUserId, headers as apiHeaders } from '../lib/api'
import { useEffect, useState } from 'react'

export default function App() {
  const [lists, setLists] = useState<any[]>([])
  const loadLists = async () => {
    const res = await fetch('/api/lists', { headers: apiHeaders() })
    setLists(await res.json())
  }
  useEffect(() => { loadLists() }, [])

  return (
    <div style={{ fontFamily: 'system-ui, Arial', height: '100vh', display: 'grid', gridTemplateRows: '56px 1fr' }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #e5e7eb' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#0ea5e9', fontWeight: 700 }}>Todo</Link>
        <nav style={{ display: 'flex', gap: 12 }}>
          <NavLink to="/" end>Lists</NavLink>
          <NavLink to="/tasks">All Tasks</NavLink>
        </nav>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <small>User:</small>
          <select defaultValue={getUserId()} onChange={e=>{ setUserId(e.target.value); location.reload() }}>
            <option value="demo-user">demo-user</option>
            <option value="alice">alice</option>
            <option value="bob">bob</option>
          </select>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 0 }}>
        <aside style={{ borderRight: '1px solid #e5e7eb', padding: 12, overflow: 'auto' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>清單</div>
          <ul style={{ display: 'grid', gap: 6 }}>
            {lists.map(l => (
              <li key={l.id}>
                <NavLink to={`/lists/${l.id}`}>{l.name}</NavLink>
              </li>
            ))}
          </ul>
        </aside>
        <main style={{ padding: 16, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
