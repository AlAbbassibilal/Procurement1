import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, KeyRound, Network } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Avatar, StatusPill, Alert } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/workflow'
import { DEPARTMENTS } from '@/data/seed'
import type { Role, User, Department, AccessLevel } from '@/types'
import { DEPARTMENTS as WORKSPACES, ACCESS_LABEL, effectiveAccess, defaultAccess } from '@/lib/departments'
import { PERMISSIONS, ROLE_PERMISSIONS, customCount } from '@/lib/permissions'
import { cx } from '@/lib/format'

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const COLORS = ['bg-brand-600', 'bg-brand-800', 'bg-accent-600', 'bg-accent-700', 'bg-ink-600', 'bg-ink-700', 'bg-ink-900', 'bg-sun-700', 'bg-info-700']

/** Per-function permissions for one user: one tab per department, a checkbox per function. */
function PermissionsEditor({ user, onChange }: { user: User; onChange: (perms: Record<string, boolean> | undefined) => void }) {
  const [dept, setDept] = useState<Department>(WORKSPACES[0]!.id)
  const roleDefault = (k: string) => ROLE_PERMISSIONS[user.role]?.includes(k) ?? false
  const value = (k: string) => user.role === 'admin' ? true : (user.permissions?.[k] ?? roleDefault(k))
  const setKey = (k: string, v: boolean) => {
    const next = { ...(user.permissions ?? {}) }
    if (v === roleDefault(k)) delete next[k]; else next[k] = v
    onChange(Object.keys(next).length ? next : undefined)
  }
  const setAll = (keys: string[], v: boolean) => {
    const next = { ...(user.permissions ?? {}) }
    keys.forEach((k) => { if (v === roleDefault(k)) delete next[k]; else next[k] = v })
    onChange(Object.keys(next).length ? next : undefined)
  }
  const list = PERMISSIONS[dept]
  const changed = customCount(user)
  return (
    <div>
      {user.role === 'admin' && <div className="mb-3"><Alert tone="info">System administrators always hold every function. Change the role to restrict this account.</Alert></div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">{WORKSPACES.map((w) => { const n = PERMISSIONS[w.id].filter((p) => value(p.key)).length; return <button key={w.id} data-testid={`perm-tab-${w.id}`} className={cx('rounded-pill px-3 py-1 text-[12px] font-medium', dept === w.id ? 'bg-brand-700 text-white' : 'bg-surface-sunken text-ink-700 hover:bg-ink-100')} onClick={() => setDept(w.id)}>{w.name} <span className="opacity-70">{n}/{PERMISSIONS[w.id].length}</span></button> })}</div>
        <div className="flex items-center gap-2 text-[12px]"><span className="text-ink-500">{changed ? `${changed} custom` : `Role defaults (${ROLE_LABEL[user.role]})`}</span>{changed > 0 && <button className="text-brand-700 hover:underline" onClick={() => onChange(undefined)}>Reset to role defaults</button>}</div>
      </div>
      {list.length === 0 ? <div className="rounded-card border border-dashed border-line p-4 text-[12.5px] text-ink-500">No function-level permissions for this workspace yet.</div> : (
        <div className="rounded-card border border-line">
          <div className="flex items-center justify-between border-b border-line bg-surface-muted px-3 py-2 text-[11.5px] text-ink-500"><span>Workspace access: <b className="text-ink-700">{ACCESS_LABEL[effectiveAccess(user)[dept]]}</b> — a function only works inside a workspace the person can open.</span>{user.role !== 'admin' && <span className="flex gap-2"><button className="text-brand-700 hover:underline" onClick={() => setAll(list.map((p) => p.key), true)}>Allow all</button><button className="text-brand-700 hover:underline" onClick={() => setAll(list.map((p) => p.key), false)}>Deny all</button></span>}</div>
          <ul className="divide-y divide-line">{list.map((p) => { const v = value(p.key); const custom = user.role !== 'admin' && user.permissions?.[p.key] !== undefined; return (
            <li key={p.key} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <input type="checkbox" data-testid={`perm-${p.key}`} checked={v} disabled={user.role === 'admin'} onChange={(e) => setKey(p.key, e.target.checked)} />
              <span className="flex-1 text-ink-800">{p.label}</span>
              <span className={cx('rounded-pill px-2 py-0.5 text-[10.5px] font-semibold', v ? 'bg-brand-50 text-brand-800' : 'bg-ink-100 text-ink-500')}>{v ? 'Allowed' : 'Denied'}</span>
              {custom && <span className="rounded-pill bg-sun-50 px-2 py-0.5 text-[10.5px] font-semibold text-sun-700" title={`Role default: ${roleDefault(p.key) ? 'allowed' : 'denied'}`}>custom</span>}
            </li>) })}</ul>
        </div>
      )}
    </div>
  )
}

export default function Users() {
  const { users, staff, upsertUser, deleteUser, currentUserId } = useStore()
  const [edit, setEdit] = useState<Partial<User> | null>(null)
  const [perm, setPerm] = useState<User | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const remove = (u: User) => {
    if (!confirm(`Delete the account of ${u.name} (${u.email})?\n\nThe person's staff record and history stay; only the login is removed.`)) return
    const r = deleteUser(u.id); if (!r.ok) setErr(r.error ?? 'Could not delete'); else setErr(null)
  }
  return (
    <>
      <PageHeader title="Users & access" subtitle="Roles drive approval chains; workspace access decides which department cards a person can open; function permissions decide exactly what they can do inside. Line managers, budget holders and approval limits live in the org chart."
        actions={<div className="flex gap-2"><Link to="/admin/org-chart" className="btn-secondary"><Network size={15} /> Org chart</Link><button className="btn-primary" onClick={() => setEdit({ role: 'requester', department: DEPARTMENTS[0], active: true, avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)] })}><Plus size={15} /> Add user</button></div>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => <div key={r} className="card px-4 py-3"><div className="text-[11.5px] uppercase tracking-[0.05em] text-ink-500">{ROLE_LABEL[r]}</div><div className="text-[18px] font-semibold text-ink-900">{users.filter((u) => u.role === r && u.active).length}</div></div>)}
      </div>
      <Card padded={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-[13px]">
          <thead><tr><th className="table-th">User</th><th className="table-th">Role</th><th className="table-th">Department</th><th className="table-th">Org chart</th><th className="table-th">Workspace access</th><th className="table-th">Functions</th><th className="table-th">Status</th><th className="table-th w-28" /></tr></thead>
          <tbody>{users.map((u) => { const st = staff.find((s) => s.userId === u.id); const mgr = st?.lineManagerId ? staff.find((s) => s.id === st.lineManagerId) : undefined; const custom = customCount(u); return (
            <tr key={u.id} className="hover:bg-surface-muted" data-testid={`user-row-${u.email}`}>
              <td className="table-td"><div className="flex items-center gap-3"><Avatar name={u.name} color={u.avatarColor} /><div><div className="font-medium text-ink-900">{u.name}</div><div className="text-[11.5px] text-ink-500">{u.email} · {u.title}</div></div></div></td>
              <td className="table-td">{ROLE_LABEL[u.role]}</td><td className="table-td">{u.department}</td>
              <td className="table-td text-[12px]">{st ? <><div className="font-mono text-ink-700">{st.rhsNumber}</div><div className="text-ink-500">{mgr ? `reports to ${mgr.name || mgr.position}` : 'no line manager'}{st.budgetHolder && <span className="ml-1 rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">budget holder{st.approvalLimitUSD !== undefined ? ` · USD ${st.approvalLimitUSD.toLocaleString()}` : ''}</span>}</div></> : <Link to="/admin/org-chart" className="text-ink-400 hover:underline">not in org chart</Link>}</td>
              <td className="table-td"><div className="flex flex-wrap gap-1">{WORKSPACES.filter((w) => effectiveAccess(u)[w.id] !== 'none').map((w) => <span key={w.id} className={`rounded-pill px-1.5 py-0.5 text-[10.5px] font-medium ${effectiveAccess(u)[w.id] === 'manage' ? 'bg-brand-50 text-brand-800' : effectiveAccess(u)[w.id] === 'edit' ? 'bg-info-50 text-info-700' : 'bg-surface-sunken text-ink-600'}`}>{w.name} · {ACCESS_LABEL[effectiveAccess(u)[w.id]]}</span>)}</div></td>
              <td className="table-td"><button className="btn-secondary btn-sm" data-testid={`perms-${u.email}`} onClick={() => setPerm(u)}><KeyRound size={13} /> {u.role === 'admin' ? 'All' : custom ? `${custom} custom` : 'Role defaults'}</button></td>
              <td className="table-td"><StatusPill status={u.active ? 'active' : 'blocked'} /></td>
              <td className="table-td"><div className="flex justify-end gap-1"><button className="btn-ghost btn-sm" title="Edit" onClick={() => setEdit(u)}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-accent-700 disabled:opacity-40" title={u.id === currentUserId ? 'You cannot delete your own account' : 'Delete account'} data-testid={`delete-${u.email}`} disabled={u.id === currentUserId} onClick={() => remove(u)}><Trash2 size={14} /></button></div></td>
            </tr>) })}</tbody>
        </table></div>
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
            <div className="sm:col-span-2 rounded-card border border-line bg-surface-muted p-3">
              <div className="mb-2 flex items-center justify-between"><div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-600">Workspace access</div><button className="text-[12px] text-brand-700 hover:underline" onClick={() => setEdit({ ...edit, access: undefined })}>Reset to role default</button></div>
              <div className="grid gap-3 sm:grid-cols-3">
                {WORKSPACES.map((w) => { const eff = { ...defaultAccess((edit.role ?? 'requester') as Role), ...(edit.access ?? {}) }; return (
                  <Field key={w.id} label={w.name}><select className="input" value={eff[w.id as Department]} onChange={(e) => setEdit({ ...edit, access: { ...eff, [w.id]: e.target.value as AccessLevel } })}>{(Object.keys(ACCESS_LABEL) as AccessLevel[]).map((a) => <option key={a} value={a}>{ACCESS_LABEL[a]}</option>)}</select></Field>) })}
              </div>
              <div className="mt-2 text-[11.5px] text-ink-500">{edit.access ? 'Custom access for this user.' : `Using the default for ${ROLE_LABEL[(edit.role ?? 'requester') as Role]}.`} Function-by-function permissions are set from the <b>Functions</b> button on the list.</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!perm} onClose={() => setPerm(null)} width="max-w-3xl" title={perm ? `Function permissions — ${perm.name}` : ''}
        footer={<><button className="btn-secondary" onClick={() => setPerm(null)}>Cancel</button><button className="btn-primary" data-testid="perm-save" onClick={() => { if (perm) upsertUser({ id: perm.id, permissions: perm.permissions }); setPerm(null) }}>Save permissions</button></>}>
        {perm && <PermissionsEditor user={perm} onChange={(permissions) => setPerm({ ...perm, permissions })} />}
      </Modal>
    </>
  )
}
