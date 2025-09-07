import { Link, Outlet, NavLink, useNavigate } from 'react-router-dom'
import { headers as apiHeaders, fetchWithCreds, clearDevUserId } from '../lib/api'
import { useEffect, useState, useCallback, useRef } from 'react'

export default function App() {
  const [lists, setLists] = useState<any[]>([])
  const [me, setMe] = useState<any | null>(null)
  const nav = useNavigate()
  const loadLists = useCallback(async () => {
    const res = await fetchWithCreds('/api/lists', { headers: apiHeaders() })
    if (res.status === 401) return
    setLists(await res.json())
  }, [])
  const loadMe = useCallback(async () => {
    const res = await fetchWithCreds('/api/auth/me', { headers: apiHeaders() })
    if (!res.ok) { setMe(null); nav('/login'); return }
    setMe(await res.json())
  }, [nav])
  useEffect(() => { loadMe(); loadLists() }, [loadMe, loadLists])

  // listen to global events to refresh UI without full reload
  useEffect(() => {
    const onAuth = () => { loadMe(); loadLists() }
    const onLists = () => { loadLists() }
    window.addEventListener('auth:changed', onAuth)
    window.addEventListener('lists:changed', onLists)
    return () => {
      window.removeEventListener('auth:changed', onAuth)
      window.removeEventListener('lists:changed', onLists)
    }
  }, [loadMe, loadLists])

  const logout = async () => {
    await fetchWithCreds('/api/auth/logout', { method: 'POST', headers: apiHeaders() })
  clearDevUserId()
    setMe(null)
    setLists([])
  window.dispatchEvent(new Event('auth:changed'))
    nav('/login')
  }
  // Always show the left lists panel across routes

  // avatar panel state
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent | PointerEvent) => {
      if (!panelRef.current) return
      if (!panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc as any)
    return () => document.removeEventListener('pointerdown', onDoc as any)
  }, [])

  const Avatar = ({ src, name, size=28 }: { src?: string | null, name?: string, size?: number }) => {
    const fallback = (name || '?').trim()
    const initials = fallback ? fallback[0]?.toUpperCase() : '?'
    const resolved = src && src.startsWith('/uploads') ? `/api${src}` : src
    if (resolved) return <img src={resolved} alt="avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e5e7eb', color: '#374151', fontWeight: 700, fontSize: size*0.45, border: '1px solid #d1d5db' }}>
        {initials}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui, Arial', height: '100vh', display: 'grid', gridTemplateRows: '56px 1fr' }}>
      {/* Header: 3-column grid so the brand can be perfectly centered */}
      <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div />
        <Link to="/" style={{ textDecoration: 'none', color: '#0ea5e9', fontWeight: 700, fontSize: 20, justifySelf: 'center' }}>Todo</Link>
        <div style={{ position: 'relative', justifySelf: 'end' }} ref={panelRef}>
          {me ? (
            <button onClick={(e)=>{ e.stopPropagation(); setOpen(v=>!v) }} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <Avatar src={me.avatar} name={me.name || me.email} />
            </button>
          ) : (
            <Link to="/login">Login</Link>
          )}
          {me && open && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 20px rgba(0,0,0,0.12)', width: 220, zIndex: 1000, padding: 8 }}>
              <div style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{me.name || me.email}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{me.email}</div>
              </div>
              <div style={{ display: 'grid', padding: 8, gap: 6 }}>
                <Link to="/profile" onClick={()=>setOpen(false)} style={{ textDecoration: 'none' }}>編輯個人檔案</Link>
                <button onClick={logout} style={{ textAlign: 'left' }}>登出</button>
              </div>
            </div>
          )}
        </div>
      </header>
      {/* Content area: center the grid to bring the left panel closer to the middle on wide screens */}
  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 0, maxWidth: 1120, margin: '0 auto', width: '100%', padding: '0 16px' }}>
        <aside style={{ borderRight: '1px solid #e5e7eb', padding: 12, overflow: 'auto' }}>
          <div style={{ fontSize: 16, color: '#6b7280', marginBottom: 8 }}>清單</div>
          <ul style={{ display: 'grid', gap: 6 }}>
            {lists.map(l => (
              <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: l.color || '#e5e7eb', border: '1px solid #d1d5db' }} />
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
