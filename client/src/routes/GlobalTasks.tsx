import { useEffect, useMemo, useState } from 'react'
import { headers, fetchWithCreds } from '../lib/api'

type Task = { id: string, title: string, status: 'todo'|'doing'|'done', listId: string }

export default function GlobalTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [lists, setLists] = useState<any[]>([])
  const listNameById = useMemo(() => Object.fromEntries(lists.map(l => [l.id, l.name])), [lists])

  const load = async () => {
  const res = await fetchWithCreds('/api/tasks', { headers: headers() })
    setTasks(await res.json())
  }
  const loadLists = async () => {
    const r = await fetchWithCreds('/api/lists', { headers: headers() })
    if (r.ok) setLists(await r.json())
  }

  useEffect(() => { load(); loadLists() }, [])

  return (
    <main>
      <h2>All Tasks</h2>
      <ul>
        {tasks.map(t => (
          <li key={t.id}>
            [{listNameById[t.listId] || t.listId}] {t.title} - {t.status}
          </li>
        ))}
      </ul>
    </main>
  )
}
