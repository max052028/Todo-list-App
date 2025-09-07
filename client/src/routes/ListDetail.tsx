import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

  return (
    <main>
      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: 8, border: '1px solid #fecaca', borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <Link to="/">← Back</Link>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: list.color || '#e5e7eb', border: '1px solid #d1d5db' }} />
        {list.name}
      </h2>
      <div style={{ display: 'flex', gap: 24 }}>
        <section style={{ flex: 1 }}>
          <h3>New Task</h3>
          {isAdmin ? (
            <>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task title" />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12, color: '#6b7280' }}>日期</label>
                <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} />
                <label style={{ fontSize: 12, color: '#6b7280' }}>時間</label>
                <select aria-label="hour" value={newHour} onChange={e=>setNewHour(e.target.value)}>
                  <option value="">--</option>
                  {Array.from({ length: 24 }).map((_,h)=>{
                    const v = String(h).padStart(2,'0');
                    return <option key={v} value={v}>{v}</option>
                  })}
                </select>
                :
                <select aria-label="minute" value={newMinute} onChange={e=>setNewMinute(e.target.value)}>
                  <option value="">--</option>
                  {Array.from({ length: 12 }).map((_,i)=>{
                    const m = String(i*5).padStart(2,'0');
                    return <option key={m} value={m}>{m}</option>
                  })}
                </select>
              </div>
              <select value={newAssignee} onChange={e=>setNewAssignee(e.target.value)} style={{ maxWidth: 240 }}>
                <option value="">未指派</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.displayName || m.userId}</option>
                ))}
              </select>
              <button onClick={createTask}>Add</button>
            </>
          ) : (
            <p style={{ opacity: 0.7 }}>Only owner/admin can create tasks.</p>
          )}
        </section>
        <section>
          <h3>Share</h3>
          <button onClick={createInvite}>Create Invite</button>
          {invite && (<div><input readOnly value={invite} style={{ width: 320 }} /></div>)}
        </section>
        <section style={{ minWidth: 260 }}>
          <h3>Members</h3>
          <ul>
            {members.map(m => (
              <li key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 8, alignItems: 'center', marginBottom: 6, maxWidth: 360 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.displayName || m.userId}>
                  {m.displayName || m.userId}
                  <span style={{ opacity: 0.6 }}> ({m.role})</span>
                </div>
                {myRole === 'owner' && (
                  <select value={m.role} onChange={e=>changeRole(m.userId, e.target.value as any)} style={{ maxWidth: 140 }}>
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
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
    </main>
  )
}
