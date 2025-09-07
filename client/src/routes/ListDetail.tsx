import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useParams } from 'react-router-dom'
import { headers as apiHeaders, fetchWithCreds } from '../lib/api'
import TaskCard from '../components/TaskCard'

type Task = {
  id: string
  title: string
  status: 'todo'|'doing'|'done'
  assigneeId?: string | null
  dueAt?: number | null
}

export default function ListDetail() {
  const { id } = useParams()
  const listId = id!
  const loc = useLocation()

  const [list, setList] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [invite, setInvite] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const myRole = members.find(m => m.userId === meId)?.role as 'owner'|'admin'|'member'|undefined
  const isAdmin = myRole === 'owner' || myRole === 'admin'

  const [newDate, setNewDate] = useState<string>('')
  const [newHour, setNewHour] = useState<string>('')
  const [newMinute, setNewMinute] = useState<string>('')
  const [newAssignee, setNewAssignee] = useState<string>('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const withTimeout = (input: RequestInfo | URL, init?: RequestInit, ms = 8000) => {
        const ac = new AbortController()
        const id = setTimeout(() => ac.abort(), ms)
        const p = fetch(input, { ...(init||{}), signal: ac.signal })
        return p.finally(() => clearTimeout(id))
      }
      const [lsRes, tsRes, memRes, meRes] = await Promise.all([
        withTimeout('/api/lists', { headers: apiHeaders(), credentials: 'include' }),
        withTimeout(`/api/lists/${listId}/tasks`, { headers: apiHeaders(), credentials: 'include' }),
        withTimeout(`/api/lists/${listId}/members`, { headers: apiHeaders(), credentials: 'include' }),
        withTimeout('/api/auth/me', { headers: apiHeaders(), credentials: 'include' })
      ])
      const ls = await lsRes.json()
      const found = (ls as any[]).find((x:any) => x.id === listId)
      if (!found) {
        setError('清單不存在或沒有權限')
      }
      setList(found || { id: listId, name: '(不可存取)' })
      const tData = tsRes.ok ? await tsRes.json() : []
      const mData = memRes.ok ? await memRes.json() : []
      setTasks(Array.isArray(tData) ? tData : [])
      setMembers(Array.isArray(mData) ? mData : [])
      const me = meRes.ok ? await meRes.json() : null
      setMeId(me?.id || null)
    } catch (e) {
      setError('載入失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount and when listId changes
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  const createTask = async () => {
    if (!title.trim()) return
    // Combine date + time (local) into epoch ms
    const dueAt = newDate ? (() => {
      const [Y, M, D] = newDate.split('-').map(Number)
      const hh = newHour ? Number(newHour) : 0
      const mm = newMinute ? Number(newMinute) : 0
      const date = new Date(Y || 0, (M || 1) - 1, D || 1, hh || 0, mm || 0, 0, 0)
      return date.getTime()
    })() : undefined
    const assigneeId = newAssignee || undefined
    await fetchWithCreds(`/api/lists/${listId}/tasks`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ title, dueAt, assigneeId }) })
    setTitle('')
    setNewDate('')
    setNewHour('')
    setNewMinute('')
    setNewAssignee('')
    load()
  }

  const toggle = async (t: Task) => {
    const status = t.status === 'done' ? 'todo' : 'done'
    await fetchWithCreds(`/api/tasks/${t.id}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ status }) })
    load()
  }

  const assign = async (taskId: string, userId: string | null) => {
    await fetchWithCreds(`/api/tasks/${taskId}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ assigneeId: userId }) })
    load()
  }

  const createInvite = async () => {
    const res = await fetchWithCreds(`/api/lists/${listId}/invites`, { method: 'POST', headers: apiHeaders() })
    const data = await res.json()
    setInvite(`${location.origin}/join/${data.token}`)
  }

  const changeRole = async (userId: string, role: 'owner'|'admin'|'member') => {
    const res = await fetchWithCreds(`/api/lists/${listId}/members/${userId}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ role }) })
    if (!res.ok) {
      try {
        const data = await res.json()
        setError(data?.error || '更新失敗')
      } catch {
        setError('更新失敗')
      }
      return
    }
    load()
  }

  const grouped = useMemo(() => ({
    todo: tasks.filter(t=>t.status==='todo'),
    done: tasks.filter(t=>t.status==='done')
  }), [tasks])

  if (loading) return <main>Loading...</main>
  if (!list) return <main>清單不存在或沒有權限</main>

  const base = `/lists/${listId}`
  const isStats = loc.pathname.endsWith('/stats')
  const isHistory = loc.pathname.endsWith('/history')
  const isSettings = loc.pathname.endsWith('/settings')

  const accent = list?.color || '#6366f1'
  const hasAside = !isStats && !isHistory && !isSettings
  return (
  <main className={`container list-layout${hasAside ? ' has-aside' : ''}`} style={{ ['--accent' as any]: accent }}>
      {error && (
        <div style={{ gridColumn: '1 / -1', background: '#fef2f2', color: '#991b1b', padding: 8, border: '1px solid #fecaca', borderRadius: 6 }}>
          {error}
        </div>
      )}
  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: list.color || '#e5e7eb', border: '1px solid #d1d5db' }} />
            {list.name}
          </h2>
        </div>
        {/* tabs are below */}
      </div>

  {/* Left column: tab content */}
  <div style={{ paddingRight: 8 }}>
        <nav className="tabs">
          <NavLink to={base} end className={({isActive})=> 'tab' + (isActive ? ' tab-active' : '')}>
            <OverviewIcon />
            <span>總覽</span>
          </NavLink>
          <NavLink to={`${base}/stats`} className={({isActive})=> 'tab' + (isActive ? ' tab-active' : '')}>
            <StatsIcon />
            <span>統計</span>
          </NavLink>
          <NavLink to={`${base}/history`} className={({isActive})=> 'tab' + (isActive ? ' tab-active' : '')}>
            <HistoryIcon />
            <span>歷史</span>
          </NavLink>
          <NavLink to={`${base}/settings`} className={({isActive})=> 'tab' + (isActive ? ' tab-active' : '')}>
            <SettingsIcon />
            <span>設定</span>
          </NavLink>
        </nav>
  {hasAside && (
          <>
            <section>
              <h3>New Task</h3>
              {isAdmin ? (
                <>
                  <input className="input" style={{ width: '100%', maxWidth: 320 }} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task title" />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>日期</label>
                    <input className="input" type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} />
                    <label style={{ fontSize: 12, color: '#6b7280' }}>時間</label>
                    <select className="select" aria-label="hour" value={newHour} onChange={e=>setNewHour(e.target.value)}>
                      <option value="">--</option>
                      {Array.from({ length: 24 }).map((_,h)=>{
                        const v = String(h).padStart(2,'0');
                        return <option key={v} value={v}>{v}</option>
                      })}
                    </select>
                    :
                    <select className="select" aria-label="minute" value={newMinute} onChange={e=>setNewMinute(e.target.value)}>
                      <option value="">--</option>
                      {Array.from({ length: 12 }).map((_,i)=>{
                        const m = String(i*5).padStart(2,'0');
                        return <option key={m} value={m}>{m}</option>
                      })}
                    </select>
                  </div>
                  <select className="select" value={newAssignee} onChange={e=>setNewAssignee(e.target.value)} style={{ maxWidth: 240 }}>
                    <option value="">未指派</option>
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.displayName || m.userId}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={createTask}>Add</button>
                </>
              ) : (
                <p style={{ opacity: 0.7 }}>Only owner/admin can create tasks.</p>
              )}
            </section>
            <section>
              <h3>Todo</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {grouped.todo.map((t:any)=> (
                  <TaskCard
                    key={t.id}
                    task={t}
                    assignees={members.map(m => ({ id: m.userId, label: m.displayName || m.userId }))}
                    isAdmin={isAdmin}
                    onToggle={()=>toggle(t)}
                    onAssign={(id, userId)=>assign(id, userId)}
                  />
                ))}
              </div>
            </section>
            <section>
              <h3>Done</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {grouped.done.map((t:any)=> (
                  <TaskCard
                    key={t.id}
                    task={t}
                    assignees={members.map(m => ({ id: m.userId, label: m.displayName || m.userId }))}
                    isAdmin={isAdmin}
                    onToggle={()=>toggle(t)}
                    onAssign={(id, userId)=>assign(id, userId)}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {isStats && (
          <StatsTab listId={listId} members={members} />
        )}
        {isHistory && (
          <HistoryTab listId={listId} />
        )}
        {isSettings && (
          <SettingsTab listId={listId} list={list} isOwner={myRole==='owner'} onUpdated={load} members={members} />
        )}
      </div>

      {/* Right column: panel only on Overview */}
      {!isStats && !isHistory && !isSettings && (
        <aside className="right-panel">
          <section>
            <h3>分享</h3>
            <button className="btn" onClick={createInvite}>建立邀請連結</button>
            {invite && (<div style={{ marginTop: 6 }}><input className="input" readOnly value={invite} style={{ width: 260 }} /></div>)}
          </section>
          <section>
            <h3>成員 <span className="muted">({members.length})</span></h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {members.map(m => (
                <div key={m.userId} title={`${m.displayName || m.userId}\n${m.email || ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 64 }}>
                  <MemberAvatar src={m.avatar} name={m.displayName} />
                  <div style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={m.displayName}>{m.displayName || '—'}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      )}
    </main>
  )
}

function MemberAvatar({ src, name, size=36 }: { src?: string | null, name?: string, size?: number }) {
  const fallback = (name || '?').trim()
  const initials = fallback ? fallback[0]?.toUpperCase() : '?'
  const resolved = src && typeof src === 'string' && src.startsWith('/uploads') ? `/api${src}` : src
  if (resolved) return <img src={resolved} alt="avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e5e7eb', color: '#374151', fontWeight: 700, fontSize: size*0.45, border: '1px solid #d1d5db' }}>
      {initials}
    </div>
  )
}

function StatsTab({ listId, members }: { listId: string, members: any[] }) {
  const [tasks, setTasks] = useState<any[]>([])
  useEffect(()=>{ (async()=>{ const r = await fetch('/api/lists/'+listId+'/tasks', { credentials: 'include' }); setTasks(await r.json()) })() }, [listId])
  const total = tasks.length
  const done = tasks.filter((t:any)=>t.status==='done').length
  const pct = total ? Math.round(done/total*100) : 0
  const perUser = members.map(m => ({ id: m.userId, name: m.displayName || m.userId, total: tasks.filter((t:any)=>t.assigneeId===m.userId).length, done: tasks.filter((t:any)=>t.assigneeId===m.userId && t.status==='done').length }))
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="總任務" value={total} />
        <StatCard label="已完成" value={done} />
        <StatCard label="完成度" value={pct + '%'} />
      </div>
      <div>
        <h4>各成員統計</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {perUser.map(u => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 60px', alignItems: 'center', gap: 8 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
              <div style={{ background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: (u.total ? Math.round(u.done/u.total*100) : 0) + '%', background: '#10b981', height: 8 }} />
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.done}/{u.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string, value: any }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 22 }}>{value}</div>
    </div>
  )
}

function HistoryTab({ listId }: { listId: string }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: any[], total: number, pageSize: number } | null>(null)
  useEffect(()=>{ (async()=>{ const r = await fetch(`/api/lists/${listId}/events?page=${page}&pageSize=10`, { credentials: 'include' }); setData(await r.json()) })() }, [listId, page])
  const items = data?.items || []
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <ul style={{ display: 'grid', gap: 6 }}>
        {items.map((ev: any) => (
          <li key={ev.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(ev.at).toLocaleString()}</div>
            <div style={{ fontWeight: 600 }}>{prettyEvent(ev)}</div>
            <div style={{ fontSize: 13, color: '#374151' }}>by {ev.actorName || '系統'}</div>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>上一頁</button>
        <button disabled={!!data && (page*10)>= (data.total||0)} onClick={()=>setPage(p=>p+1)}>下一頁</button>
      </div>
    </div>
  )
}

function prettyEvent(ev: any) {
  switch (ev.type) {
    case 'list.created': return '建立清單'
    case 'list.updated': return '更新清單'
    case 'list.deleted': return '刪除清單'
    case 'invite.created': return '建立邀請連結'
    case 'invite.accepted': return '接受邀請'
    case 'member.role_changed': return '變更成員角色'
    case 'task.created': return `新增任務 ${ev.data?.title || ''}`.trim()
    case 'task.updated': return '更新任務'
    case 'task.deleted': return '刪除任務'
    default: return ev.type
  }
}

function SettingsTab({ listId, list, isOwner, onUpdated, members }: { listId: string, list: any, isOwner: boolean, onUpdated: () => void, members: any[] }) {
  const [name, setName] = useState(list?.name || '')
  const [color, setColor] = useState(list?.color || '')
  const [saving, setSaving] = useState(false)
  const update = async () => {
    if (!isOwner) return alert('只有 Owner 可設定')
    setSaving(true)
    const r = await fetch('/api/lists/'+listId, { method: 'PATCH', credentials: 'include', headers: apiHeaders(), body: JSON.stringify({ name, color: color || null }) })
    setSaving(false)
    if (!r.ok) return alert('更新失敗')
    onUpdated()
  }
  const del = async () => {
    if (!isOwner) return alert('只有 Owner 可設定')
    if (!confirm('刪除清單？此動作無法復原')) return
    const r = await fetch('/api/lists/'+listId, { method: 'DELETE', credentials: 'include' })
    if (r.status === 204) location.href = '/'
    else alert('刪除失敗')
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="muted">只有 Owner 能編輯</div>
      <div className="card card-pad" style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <div className="field">
          <span className="label">清單名稱</span>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} disabled={!isOwner} style={{ maxWidth: 320 }} />
        </div>
        <div className="field">
          <span className="label">顏色</span>
          <input className="input" type="color" value={color || '#e5e7eb'} onChange={e=>setColor(e.target.value)} disabled={!isOwner} style={{ width: 64, padding: 4, height: 36 }} />
        </div>
        <div>
          <button className="btn btn-primary" disabled={!isOwner || saving} onClick={update}>{saving ? '儲存中…' : '儲存變更'}</button>
        </div>
      </div>
      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>刪除清單</div>
            <div className="muted">刪除後無法復原，請小心操作</div>
          </div>
          <button className="btn btn-danger" disabled={!isOwner} onClick={del}>刪除清單</button>
        </div>
      </div>
      {isOwner && (
        <div className="card card-pad" style={{ display: 'grid', gap: 8, maxWidth: 680 }}>
          <h4 style={{ margin: 0 }}>成員角色</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {members.map(m => (
              <div key={m.userId} style={{ display: 'grid', gridTemplateColumns: '1fr 180px', alignItems: 'center', gap: 8 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName} <span className="muted">({m.email || '—'})</span></div>
                <RoleSelect listId={listId} userId={m.userId} value={m.role} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleSelect({ listId, userId, value }: { listId: string, userId: string, value: 'owner'|'admin'|'member' }) {
  const [val, setVal] = useState(value)
  const [busy, setBusy] = useState(false)
  const onChange = async (next: 'owner'|'admin'|'member') => {
    setVal(next); setBusy(true)
    try {
      const r = await fetch(`/api/lists/${listId}/members/${userId}`, { method: 'PATCH', credentials: 'include', headers: apiHeaders(), body: JSON.stringify({ role: next }) })
      if (!r.ok) alert('更新角色失敗')
    } finally { setBusy(false) }
  }
  return (
    <select value={val} onChange={e=>onChange(e.target.value as any)} disabled={busy} style={{ height: 36 }}>
      <option value="owner">owner</option>
      <option value="admin">admin</option>
      <option value="member">member</option>
    </select>
  )
}

// Inline tab icons (inherit text color via currentColor)
function OverviewIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function StatsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="21" x2="20" y2="21" />
      <rect x="6" y="10" width="3" height="7" rx="1" />
      <rect x="11" y="6" width="3" height="11" rx="1" />
      <rect x="16" y="13" width="3" height="4" rx="1" />
    </svg>
  )
}

function HistoryIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v5h5" />
      <path d="M3.5 9a8 8 0 1 1 2 6" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.3l.06.06c.46.46 1.12.6 1.71.39.59-.21 1-.77 1-1.39V2a2 2 0 1 1 4 0v.09c0 .62.41 1.18 1 1.39.59.21 1.25.07 1.71-.39l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.6 1.12-.39 1.71.21.59.77 1 1.39 1H21a2 2 0 1 1 0 4h-.09c-.62 0-1.18.41-1.39 1z" />
    </svg>
  )
}
