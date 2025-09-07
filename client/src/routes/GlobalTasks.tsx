import { useEffect, useState } from 'react'
import { headers, fetchWithCreds } from '../lib/api'

type Task = { id: string, title: string, status: 'todo'|'doing'|'done', listId: string }

export default function GlobalTasks() {
  const [tasks, setTasks] = useState<Task[]>([])

  const load = async () => {
  const res = await fetchWithCreds('/api/tasks', { headers: headers() })
    setTasks(await res.json())
  }

  useEffect(() => { load() }, [])

  return (
    <main>
      <h2>All Tasks</h2>
      <ul>
        {tasks.map(t => (
          <li key={t.id}>
            [{t.listId}] {t.title} - {t.status}
          </li>
        ))}
      </ul>
    </main>
  )
}
