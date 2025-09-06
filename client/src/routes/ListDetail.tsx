import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUserId, headers as apiHeaders } from '../lib/api'
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
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const myRole = members.find(m => m.userId === getUserId())?.role as 'owner'|'admin'|'member'|undefined
  const isAdmin = myRole === 'owner' || myRole === 'admin'
  const [newDue, setNewDue] = useState<string>('')
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
      const [lsRes, tsRes, memRes] = await Promise.all([
        withTimeout('/api/lists', { headers: apiHeaders() }),
        withTimeout(`/api/lists/${listId}/tasks`, { headers: apiHeaders() }),
        withTimeout(`/api/lists/${listId}/members`, { headers: apiHeaders() })
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
  const dueAt = newDue ? new Date(newDue).getTime() : undefined
  const assigneeId = newAssignee || undefined
  await fetch(`/api/lists/${listId}/tasks`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ title, dueAt, assigneeId }) })
    setTitle('')
  setNewDue('')
  setNewAssignee('')
    load()
  }

  const toggle = async (t: Task) => {
    const status = t.status === 'done' ? 'todo' : 'done'
  await fetch(`/api/tasks/${t.id}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ status }) })
    load()
  }

  const assign = async (taskId: string, userId: string | null) => {
  await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ assigneeId: userId }) })
    load()
  }

  const createInvite = async () => {
  const res = await fetch(`/api/lists/${listId}/invites`, { method: 'POST', headers: apiHeaders() })
    const data = await res.json()
    setInvite(`${location.origin}/join/${data.token}`)
  }

  const changeRole = async (userId: string, role: 'owner'|'admin'|'member') => {
    await fetch(`/api/lists/${listId}/members/${userId}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ role }) })
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
      <h2>{list.name}</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        <section style={{ flex: 1 }}>
          <h3>New Task</h3>
          {isAdmin ? (
            <>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task title" />
              <input type="datetime-local" value={newDue} onChange={e=>setNewDue(e.target.value)} />
              <select value={newAssignee} onChange={e=>setNewAssignee(e.target.value)}>
                <option value="">未指派</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.userId}</option>
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
              <li key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span>{m.userId}</span>
                <span style={{ opacity: 0.6 }}>({m.role})</span>
                {myRole === 'owner' && (
                  <select value={m.role} onChange={e=>changeRole(m.userId, e.target.value as any)}>
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
              assignees={members.map(m => ({ id: m.userId }))}
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
              assignees={members.map(m => ({ id: m.userId }))}
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
