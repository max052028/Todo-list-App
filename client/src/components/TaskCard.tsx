type Props = {
  task: any
  assignees?: Array<{ id: string; label?: string }>
  isAdmin?: boolean
  onToggle?: (taskId: string) => void
  onAssign?: (taskId: string, userId: string | null) => void
  onDelete?: (taskId: string) => void
  canToggle?: boolean
}

export default function TaskCard({ task, assignees = [], isAdmin, onToggle, onAssign, onDelete, canToggle }: Props) {
  const due = task.dueAt ? new Date(Number(task.dueAt)) : null
  const assignee = task.assigneeId || ''
  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
      {isAdmin && (
        <button aria-label="刪除" title="刪除" onClick={()=>onDelete?.(task.id)}
          style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
          {/* inline trash icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input className="checkbox" type="checkbox" checked={task.status==='done'} disabled={!canToggle} onChange={()=>onToggle?.(task.id)} title={canToggle ? '切換完成狀態' : '只有負責人可切換'} />
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
