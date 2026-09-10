import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Avatar, StatusPill } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/workflow'
import { DEPARTMENTS } from '@/data/seed'
import type { Role, User } from '@/types'

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const COLORS = ['bg-brand-600', 'bg-brand-800', 'bg-accent-600', 'bg-accent-700', 'bg-ink-600', 'bg-ink-700', 'bg-ink-900', 'bg-sun-700', 'bg-info-700']

export default function Users() {
  const { users, upsertUser } = useStore()
  const [edit, setEdit] = useState<Partial<User> | null>(null)
  return (
    <>
      <PageHeader title="Users & roles" subtitle="Accounts, roles and departments drive who can raise, approve, source, and sign."
        actions={<button className="btn-primary" onClick={() => setEdit({ role: 'requester', department: DEPARTMENTS[0], active: true, avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)] })}><Plus size={15} /> Add user</button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => <div key={r} className="card px-4 py-3"><div className="text-[11.5px] uppercase tracking-[0.05em] text-ink-500">{ROLE_LABEL[r]}</div><div className="text-[18px] font-semibold text-ink-900">{users.filter((u) => u.role === r && u.active).length}</div></div>)}
      </div>
      <Card padded={false}>
        <table className="w-full text-[13px]">
          <thead><tr><th className="table-th">User</th><th className="table-th">Role</th><th className="table-th">Department</th><th className="table-th">Title</th><th className="table-th">Status</th><th className="table-th w-10" /></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id} className="hover:bg-surface-muted">
              <td className="table-td"><div className="flex items-center gap-3"><Avatar name={u.name} color={u.avatarColor} /><div><div className="font-medium text-ink-900">{u.name}</div><div className="text-[11.5px] text-ink-500">{u.email}</div></div></div></td>
              <td className="table-td">{ROLE_LABEL[u.role]}</td><td className="table-td">{u.department}</td><td className="table-td">{u.title}</td>
              <td className="table-td"><StatusPill status={u.active ? 'active' : 'blocked'} /></td>
              <td className="table-td"><button className="btn-ghost btn-sm" onClick={() => setEdit(u)}><Pencil size={14} /></button></td>
            </tr>))}</tbody>
        </table>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit user' : 'Add user'}
        footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!edit?.name || !edit?.email) return alert('Name and email are required.'); upsertUser(edit!); setEdit(null) }}>Save</button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email" required><input className="input" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Role"><select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <Field label="Department"><select className="input" value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Field label="Job title" className="sm:col-span-2"><input className="input" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Password (demo)"><input className="input" value={edit.password ?? 'rhs2025'} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            <Field label="Status"><select className="input" value={edit.active ? '1' : '0'} onChange={(e) => setEdit({ ...edit, active: e.target.value === '1' })}><option value="1">Active</option><option value="0">Deactivated</option></select></Field>
          </div>
        )}
      </Modal>
    </>
  )
}
