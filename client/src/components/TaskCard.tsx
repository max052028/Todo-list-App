type Props = {
  task: any
  assignees?: Array<{ id: string; label?: string }>
  isAdmin?: boolean
  onToggle?: (taskId: string) => void
  onAssign?: (taskId: string, userId: string | null) => void
}

export default function TaskCard({ task, assignees = [], isAdmin, onToggle, onAssign }: Props) {
  const due = task.dueAt ? new Date(Number(task.dueAt)) : null
  const assignee = task.assigneeId || ''
  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input className="checkbox" type="checkbox" checked={task.status==='done'} onChange={()=>onToggle?.(task.id)} />
        <div style={{ fontWeight: 600 }}>{task.title}</div>
      </div>
      <div className="muted" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          負責人：{isAdmin ? (
            <select className="select" value={assignee} onChange={e=>onAssign?.(task.id, e.target.value || null)}>
              <option value="">未指派</option>
              {assignees.map(a => (
                <option key={a.id} value={a.id}>{a.label || a.id}</option>
              ))}
            </select>
          ) : (assignee || '未指派')}
        </div>
        <div>
          截止：{due ? due.toLocaleString() : '未設定'}
        </div>
      </div>
    </div>
  )
}
