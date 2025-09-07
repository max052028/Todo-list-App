import { Link, Outlet, NavLink, useNavigate } from 'react-router-dom'
import { headers as apiHeaders, fetchWithCreds } from '../lib/api'
import { useEffect, useState } from 'react'

export default function App() {
  const [lists, setLists] = useState<any[]>([])
  const [me, setMe] = useState<any | null>(null)
  const nav = useNavigate()
  const loadLists = async () => {
    const res = await fetchWithCreds('/api/lists', { headers: apiHeaders() })
    if (res.status === 401) return
    setLists(await res.json())
  }
  const loadMe = async () => {
    const res = await fetchWithCreds('/api/auth/me', { headers: apiHeaders() })
    if (!res.ok) { setMe(null); nav('/login'); return }
    setMe(await res.json())
  }
  useEffect(() => { loadMe(); loadLists() }, [])

  const logout = async () => {
    await fetchWithCreds('/api/auth/logout', { method: 'POST', headers: apiHeaders() })
    setMe(null)
    setLists([])
    nav('/login')
  }

  return (
    <div style={{ fontFamily: 'system-ui, Arial', height: '100vh', display: 'grid', gridTemplateRows: '56px 1fr' }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #e5e7eb' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#0ea5e9', fontWeight: 700 }}>Todo</Link>
        <nav style={{ display: 'flex', gap: 12 }}>
          <NavLink to="/" end>Lists</NavLink>
          <NavLink to="/tasks">All Tasks</NavLink>
        </nav>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {me ? (
            <>
              <small>{me.email || me.name}</small>
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
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
