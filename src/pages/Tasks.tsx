import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, CheckCircle2, Circle, Clock } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Tabs, Modal, Field, Stat } from '@/components/ui'
import { fmtDate, cx } from '@/lib/format'
import type { Task } from '@/types'

export function TaskModal({ open, onClose, projectId, projectCode, link }: { open: boolean; onClose: () => void; projectId?: string; projectCode?: string; link?: string }) {
  const { users, createTask } = useStore()
  const user = useCurrentUser()!
  const [t, setT] = useState<{ title: string; description: string; assigneeId: string; dueDate: string; priority: Task['priority'] }>({ title: '', description: '', assigneeId: user.id, dueDate: '', priority: 'normal' })
  return (
    <Modal open={open} onClose={onClose} title="Assign a task" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => { if (!t.title.trim()) return alert('Title is required'); const u = users.find((x) => x.id === t.assigneeId)!; createTask({ title: t.title.trim(), description: t.description, assigneeId: u.id, assigneeName: u.name, dueDate: t.dueDate || undefined, priority: t.priority, projectId, projectCode, link }); setT({ title: '', description: '', assigneeId: user.id, dueDate: '', priority: 'normal' }); onClose() }}>Assign</button></>}>
      <div className="space-y-3">
        <Field label="Task" required><input className="input" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="What needs to be done" /></Field>
        <Field label="Details"><textarea className="input min-h-[64px]" value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Assign to"><select className="input" value={t.assigneeId} onChange={(e) => setT({ ...t, assigneeId: e.target.value })}>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Due"><input type="date" className="input" value={t.dueDate} onChange={(e) => setT({ ...t, dueDate: e.target.value })} /></Field>
          <Field label="Priority"><select className="input" value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value as Task['priority'] })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></Field>
        </div>
        {projectCode && <div className="text-[12px] text-ink-500">Linked to project {projectCode}. The assignee is notified and sees it on their profile.</div>}
      </div>
    </Modal>
  )
}

export function TaskList({ tasks, compact }: { tasks: Task[]; compact?: boolean }) {
  const { updateTask } = useStore()
  const user = useCurrentUser()!
  if (!tasks.length) return <div className="px-5 py-6 text-center text-[13px] text-ink-500">No tasks.</div>
  return (
    <ul className="divide-y divide-line">{tasks.map((t) => { const late = t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date(); return (
      <li key={t.id} className="flex items-start gap-3 px-5 py-3">
        <button className={cx('mt-0.5 shrink-0', t.status === 'done' ? 'text-brand-600' : 'text-ink-300 hover:text-brand-600')} title={t.status === 'done' ? 'Reopen' : 'Mark done'} onClick={() => updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' })}>{t.status === 'done' ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
        <div className="min-w-0 flex-1">
          <div className={cx('text-[13.5px] font-medium', t.status === 'done' ? 'text-ink-400 line-through' : 'text-ink-900')}>{t.title}{t.priority === 'high' && t.status !== 'done' && <span className="ml-2 rounded-pill bg-accent-50 px-1.5 text-[10.5px] font-semibold text-accent-700">HIGH</span>}</div>
          {!compact && t.description && <div className="text-[12.5px] text-ink-600">{t.description}</div>}
          <div className="text-[11.5px] text-ink-500">{t.projectCode && <Link to={t.link ?? `/grants`} className="text-brand-700 hover:underline">{t.projectCode}</Link>}{t.projectCode && ' · '}{t.assigneeId === user.id ? `from ${t.createdByName}` : `for ${t.assigneeName}`}{t.dueDate && <span className={cx(late && 'font-medium text-accent-700')}> · due {fmtDate(t.dueDate)}{late && ' · overdue'}</span>}</div>
        </div>
        {t.status !== 'done' && <select className="input w-32 text-[12px]" value={t.status} onChange={(e) => updateTask(t.id, { status: e.target.value as Task['status'] })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option></select>}
      </li>) })}</ul>
  )
}

export default function Tasks() {
  const user = useCurrentUser()!
  const { tasks } = useStore()
  const [tab, setTab] = useState<'mine' | 'assigned' | 'done'>('mine')
  const [open, setOpen] = useState(false)
  const mine = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done'), assigned = tasks.filter((t) => t.createdBy === user.id && t.assigneeId !== user.id && t.status !== 'done'), done = tasks.filter((t) => (t.assigneeId === user.id || t.createdBy === user.id) && t.status === 'done')
  const rows = { mine, assigned, done }[tab].sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
  return (
    <>
      <PageHeader title="My tasks" subtitle="Tasks assigned to you from any project or colleague, and the ones you assigned to others." actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Assign a task</button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><Stat label="Open — assigned to me" value={mine.length} tone={mine.length ? 'sun' : 'default'} icon={<Clock size={18} />} /><Stat label="Overdue" value={mine.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length} tone="accent" /><Stat label="I assigned to others" value={assigned.length} /></div>
      <Tabs tabs={[{ id: 'mine', label: 'Assigned to me', count: mine.length }, { id: 'assigned', label: 'Assigned by me', count: assigned.length }, { id: 'done', label: 'Completed' }]} value={tab} onChange={setTab} />
      <div className="mt-5"><Card padded={false}><TaskList tasks={rows} /></Card></div>
      <TaskModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
