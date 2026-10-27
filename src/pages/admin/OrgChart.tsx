import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Users, Landmark, ShieldCheck, ChevronRight, Network, List, Trash2 } from 'lucide-react'
import { OrgChartSvg } from '@/components/OrgChartSvg'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Alert, Stat, Avatar } from '@/components/ui'
import { can } from '@/lib/permissions'
import { lineManagerSteps } from '@/lib/workflow'
import { cx } from '@/lib/format'
import type { StaffMember, StaffStatus } from '@/types'

/**
 * Org chart — who reports to whom, who holds a budget and up to what amount they may approve.
 * The requisition workflow reads this: the requester's line manager approves first, and when the
 * amount exceeds that manager's limit the request escalates to the next manager up the chart.
 */
export default function OrgChart() {
  const user = useCurrentUser()!
  const { staff, users, settings, upsertStaff, deleteStaff, updateSettings, masterBudgets, mergeProjectPosition, removeProjectPosition } = useStore()
  const [placing, setPlacing] = useState<Record<string, { manager?: string; same?: string }>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const canEdit = can(user, 'hr.staff.manage')
  const [edit, setEdit] = useState<Partial<StaffMember> | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'chart' | 'list'>('chart')
  const [simReq, setSimReq] = useState<string>('')
  const [simAmt, setSimAmt] = useState<string>('1000')

  /** Positions created automatically from a granted project budget that nobody has placed yet: kept in the salary plan, not drawn until placed, merged or removed. */
  const isUnplaced = (s: StaffMember) => !!s.sourceProjectId && !s.lineManagerId && !s.name.trim() && s.status === 'planned'
  const unplaced = staff.filter((s) => s.status !== 'left' && isUnplaced(s))
  const active = staff.filter((s) => s.status !== 'left' && !isUnplaced(s))
  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])
  const children = (id: string) => active.filter((s) => s.lineManagerId === id).sort((a, b) => (a.name || a.position).localeCompare(b.name || b.position))
  const roots = active.filter((s) => !s.lineManagerId || !byId.has(s.lineManagerId) || byId.get(s.lineManagerId)!.status === 'left')
  const accountOf = (s: StaffMember) => users.find((u) => u.id === s.userId)
  const holders = active.filter((s) => s.budgetHolder)
  const unlinked = active.filter((s) => !s.userId && s.name.trim() && !s.actingStaffId)
  const noManager = roots.filter((s) => s.id !== roots[0]?.id)

  // Would-be approval path for a sample requisition
  const sim = useMemo(() => {
    const st = staff.find((s) => s.id === simReq); if (!st?.userId) return []
    return lineManagerSteps(st.userId, staff, users, Number(simAmt) || 0)
  }, [simReq, simAmt, staff, users])

  const isDesc = (candidate: string, of: string): boolean => { let cur = byId.get(candidate); const seen = new Set<string>(); while (cur?.lineManagerId && !seen.has(cur.id)) { if (cur.lineManagerId === of) return true; seen.add(cur.id); cur = byId.get(cur.lineManagerId) } return false }

  const Node = ({ s, depth }: { s: StaffMember; depth: number }) => {
    const kids = children(s.id); const u = accountOf(s); const collapsed = open[s.id] === false
    return (
      <li>
        <div className={cx('flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 hover:bg-surface-muted', depth === 0 && 'border-brand-200')} style={{ marginLeft: depth * 22 }} data-testid={`org-${s.rhsNumber}`}>
          <button className={cx('text-ink-400', !kids.length && 'invisible')} onClick={() => setOpen({ ...open, [s.id]: collapsed })}><ChevronRight size={14} className={cx('transition-transform', !collapsed && 'rotate-90')} /></button>
          <Avatar name={s.name || s.position} color={u?.avatarColor} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 text-[13px]"><span className="font-medium text-ink-900">{s.actingStaffId ? <>{active.find((x) => x.id === s.actingStaffId)?.name} <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">acting</span></> : s.name || <i className="text-ink-500">(to recruit)</i>}</span><span className="text-ink-500">{s.position}</span><span className="font-mono text-[11px] text-ink-400">{s.rhsNumber}</span></div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
              <span>{s.department}{s.country ? ` · ${s.country}` : ''}</span>
              {u ? <span className="rounded-pill bg-surface-sunken px-1.5 py-0.5">{u.email}</span> : <span className="rounded-pill bg-sun-50 px-1.5 py-0.5 text-sun-700">no account</span>}
              {s.budgetHolder && <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800"><Landmark size={10} className="mr-0.5 inline" />budget holder</span>}
              {s.budgetHolder && <span className="rounded-pill bg-info-50 px-1.5 py-0.5 font-semibold text-info-700"><ShieldCheck size={10} className="mr-0.5 inline" />{s.approvalLimitUSD !== undefined ? `approves up to USD ${s.approvalLimitUSD.toLocaleString()}` : 'no approval limit'}</span>}
              {kids.length > 0 && <span className="text-ink-400">{kids.length} direct report{kids.length === 1 ? '' : 's'}</span>}
            </div>
          </div>
          {canEdit && <button className="btn-ghost btn-sm" data-testid={`org-edit-${s.rhsNumber}`} onClick={() => setEdit(s)}><Pencil size={13} /></button>}
        </div>
        {!collapsed && kids.length > 0 && <ul className="mt-1 space-y-1">{kids.map((k) => <Node key={k.id} s={k} depth={depth + 1} />)}</ul>}
      </li>
    )
  }

  return (
    <>
      <PageHeader title="Org chart" subtitle="Who reports to whom, who holds a budget and up to what amount they may approve. Requisitions go to the requester's line manager first and escalate up the chart while the amount exceeds each manager's limit; the approval matrix then adds the policy steps."
        actions={<div className="flex gap-2"><Link to="/hr/staff" className="btn-secondary"><Users size={15} /> Staff register</Link>{canEdit && <button className="btn-primary" onClick={() => setEdit({ position: '', name: '', department: '', country: settings.countries[0], status: 'planned' })}><Plus size={15} /> Add position</button>}</div>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-4"><Stat label="People" value={active.filter((s) => s.name.trim() && !s.actingStaffId).length} hint={`${active.filter((s) => !s.name.trim() && !s.actingStaffId).length} vacant position(s) · ${active.reduce((n, s) => n + (s.plannedTeam ?? []).reduce((m, t) => m + t.count, 0), 0)} planned to recruit`} /><Stat label="Budget holders" value={holders.length} /><Stat label="Hired without platform account" value={unlinked.length} tone={unlinked.length ? 'sun' : 'default'} /><Stat label="Without line manager" value={noManager.length} tone={noManager.length ? 'sun' : 'default'} /></div>
      {msg && <div className="mb-4"><Alert tone="success">{msg}</Alert></div>}
      {!canEdit && <div className="mb-4"><Alert tone="info">Read-only view. Editing the org chart needs the “Edit the staff register and the org chart” function (Users & access → Permissions).</Alert></div>}
      {unplaced.length > 0 && (
        <Card className="mb-6" title={`${unplaced.length} position${unplaced.length === 1 ? '' : 's'} from project budgets — not on the organogram yet`} description="Created when a project was granted (one per “new position” salary line). They stay on the master salary plan but are not drawn until you place each one under a manager, mark it as the same as an existing position, or remove it.">
          <div className="overflow-x-auto"><table className="w-full text-[12.5px]" data-testid="unplaced-table">
            <thead><tr><th className="table-th">Position</th><th className="table-th">Project</th><th className="table-th">Country</th><th className="table-th w-64">Place under</th><th className="table-th w-64">Same as existing position</th><th className="table-th w-28" /></tr></thead>
            <tbody>{unplaced.map((s) => { const pl = placing[s.id] ?? {}; return (
              <tr key={s.id} className="border-t border-line" data-testid={`unplaced-${s.rhsNumber}`}>
                <td className="table-td"><div className="font-medium text-ink-900">{s.position}</div><div className="font-mono text-[11px] text-ink-400">{s.rhsNumber}{s.monthlySalary ? ` · ${s.currency} ${s.monthlySalary.toLocaleString()}/mo` : ''}</div></td>
                <td className="table-td text-ink-600">{s.sourceProjectCode ?? ''}{s.sourceLineCode ? ` · ${s.sourceLineCode}` : ''}</td>
                <td className="table-td text-ink-600">{s.country}</td>
                <td className="table-td"><div className="flex gap-1"><select className="input text-[12px]" data-testid={`place-${s.rhsNumber}`} value={pl.manager ?? ''} onChange={(e) => setPlacing({ ...placing, [s.id]: { ...pl, manager: e.target.value } })}><option value="">— choose manager —</option>{active.filter((m) => m.name.trim() || m.actingStaffId).map((m) => <option key={m.id} value={m.id}>{m.actingStaffId ? active.find((x) => x.id === m.actingStaffId)?.name : m.name} · {m.position}</option>)}</select>{canEdit && <button className="btn-primary btn-sm" data-testid={`place-ok-${s.rhsNumber}`} disabled={!pl.manager} onClick={() => { upsertStaff({ id: s.id, position: s.position, lineManagerId: pl.manager }); setMsg(`${s.position} placed on the organogram.`) }}>Place</button>}</div></td>
                <td className="table-td"><div className="flex gap-1"><select className="input text-[12px]" data-testid={`same-${s.rhsNumber}`} value={pl.same ?? ''} onChange={(e) => setPlacing({ ...placing, [s.id]: { ...pl, same: e.target.value } })}><option value="">— choose position —</option>{active.map((m) => <option key={m.id} value={m.id}>{m.position}{m.name ? ` · ${m.name}` : m.actingStaffId ? ` · acting ${active.find((x) => x.id === m.actingStaffId)?.name}` : ' · vacant'}</option>)}</select>{canEdit && <button className="btn-secondary btn-sm" data-testid={`same-ok-${s.rhsNumber}`} disabled={!pl.same} onClick={() => { mergeProjectPosition(s.id, pl.same!); setMsg(`${s.position} merged — the budget line now pays the existing position.`) }}>Merge</button>}</div></td>
                <td className="table-td text-right">{canEdit && <button className="btn-ghost btn-sm text-accent-700" data-testid={`drop-${s.rhsNumber}`} onClick={() => { if (confirm(`Remove “${s.position}”? The budget line is flagged as a new position again.`)) { removeProjectPosition(s.id); setMsg(`${s.position} removed.`) } }}><Trash2 size={13} /> Remove</button>}</td>
              </tr>) })}</tbody>
          </table></div>
        </Card>
      )}
      <div className={cx('grid gap-6', view === 'chart' ? 'xl:grid-cols-1' : 'xl:grid-cols-3')}>
        <Card className={view === 'chart' ? '' : 'xl:col-span-2'} title={view === 'chart' ? 'Organogram' : 'Reporting lines'} description={view === 'chart' ? 'Boxed chart as in the RHS organogram deck — Amman in green, Gaza in pink and red, vacancies in amber, acting in light green. Click a box to edit it, the circle to fold a team.' : 'Expand a person to see their reports. The first root is the head of the organisation.'}
          actions={<div className="flex rounded-control bg-surface-muted p-0.5" role="radiogroup"><button role="radio" aria-checked={view === 'chart'} data-testid="org-view-chart" className={cx('flex items-center gap-1 rounded-control px-2.5 py-1 text-[12.5px] font-medium', view === 'chart' ? 'bg-surface shadow-card text-ink-900' : 'text-ink-600')} onClick={() => setView('chart')}><Network size={13} /> Chart</button><button role="radio" aria-checked={view === 'list'} data-testid="org-view-list" className={cx('flex items-center gap-1 rounded-control px-2.5 py-1 text-[12.5px] font-medium', view === 'list' ? 'bg-surface shadow-card text-ink-900' : 'text-ink-600')} onClick={() => setView('list')}><List size={13} /> List</button></div>}>
          {active.length === 0 ? <div className="text-[13px] text-ink-500">No staff yet — add the first person (usually the Executive Director).</div> : view === 'chart' ? <OrgChartSvg staff={active} roots={roots} users={users} title={`${settings.orgName} — Organogram ${new Date().getFullYear()}`} onSelect={canEdit ? (s) => setEdit(s) : undefined} canEdit={canEdit} /> : <ul className="space-y-1">{roots.map((r) => <Node key={r.id} s={r} depth={0} />)}</ul>}
        </Card>
        <div className={view === 'chart' ? 'grid gap-6 md:grid-cols-2' : 'space-y-6'}>
          <Card title="Escalation preview" description="Which managers a requisition would go to, before the approval matrix steps.">
            <div className="space-y-3">
              <Field label="Requester"><select className="input" data-testid="sim-req" value={simReq} onChange={(e) => setSimReq(e.target.value)}><option value="">— choose —</option>{active.filter((s) => s.userId).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.position}</option>)}</select></Field>
              <Field label="Amount (USD)"><input type="number" className="input" data-testid="sim-amt" value={simAmt} onChange={(e) => setSimAmt(e.target.value)} /></Field>
              {simReq && (sim.length === 0 ? <div className="text-[12.5px] text-ink-500">No org-chart approvers: the requester has no line manager with a platform account.</div> : <ol className="space-y-1 text-[12.5px]" data-testid="sim-steps">{sim.map((st, i) => <li key={i} className="flex items-center gap-2 rounded-card bg-surface-muted px-2 py-1"><span className="font-mono text-ink-400">{i + 1}.</span>{st.label}</li>)}</ol>)}
            </div>
          </Card>
          <Card title="Budget holders" description="Shown on the master budget and used as first approvers.">
            {holders.length === 0 ? <div className="text-[12.5px] text-ink-500">None yet — tick “Budget holder” on a person.</div> : <ul className="divide-y divide-line text-[12.5px]">{holders.map((h) => <li key={h.id} className="flex items-center justify-between py-1.5"><span><b className="text-ink-900">{h.name || h.position}</b> <span className="text-ink-500">{h.position}</span></span><span className="font-mono text-ink-600">{h.approvalLimitUSD !== undefined ? `≤ USD ${h.approvalLimitUSD.toLocaleString()}` : 'no limit'}</span></li>)}</ul>}
          </Card>
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} width="max-w-2xl" title={edit?.id ? `Org chart — ${edit.name || edit.position}` : 'Add person to the org chart'}
        footer={<>
          {edit?.id && <button className="btn-danger-soft mr-auto" data-testid="org-remove" onClick={() => { const reports = staff.filter((x) => x.lineManagerId === edit.id && x.status !== 'left'); if (!confirm(`Remove the position “${edit.position}”${edit.name ? ` (${edit.name})` : ''} from the organogram?${reports.length ? `\n\n${reports.length} position(s) report to it — they will be moved under ${staff.find((x) => x.id === edit.lineManagerId)?.name || staff.find((x) => x.id === edit.lineManagerId)?.position || 'the top of the chart'}.` : ''}\n\nThe linked platform account (if any) is kept; the master budget line is removed.`)) return; reports.forEach((r) => upsertStaff({ id: r.id, position: r.position, lineManagerId: edit.lineManagerId })); deleteStaff(edit.id!); setEdit(null); setMsg('Position removed — organogram, salary plan and master budget updated.') }}><Trash2 size={15} /> Remove position</button>}
          {edit?.id && <button className="btn-secondary" data-testid="org-add-under" onClick={() => setEdit({ position: '', name: '', department: edit.department, country: edit.country, status: 'planned', lineManagerId: edit.id })}><Plus size={15} /> Add position under this</button>}
          <button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" data-testid="org-save" onClick={() => { if (!edit?.position) return alert('Position is required.'); if (edit.status !== 'planned' && !edit.name?.trim() && !edit.actingStaffId) return alert('Enter the person’s name, choose who holds the position in acting capacity, or set it to Vacant.'); if ((edit.plannedTeam ?? []).some((t) => !t.position.trim() || t.count < 1)) return alert('Each planned team row needs a position and a count.'); upsertStaff({ ...edit, position: edit.position! } as Partial<StaffMember> & { position: string }); setEdit(null); setMsg(masterBudgets.some((m) => m.status === 'draft') ? 'Saved — organogram, staff register, salary plan and the draft master budget updated.' : 'Saved — organogram, staff register and salary plan updated. Create or re-open a master budget to carry positions into it.') }}>Save</button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Position" required><input className="input" value={edit.position ?? ''} onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></Field>
            <Field label="Department"><input className="input" value={edit.department ?? ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></Field>
            <Field label="E-mail" hint="Contact address when the person has no platform account."><input className="input" type="email" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Country / office" hint="New countries are added to the platform's country list (header selector, master budget, projects)."><select className="input" data-testid="org-country" value={edit.country ?? ''} onChange={(e) => { if (e.target.value === '__new') { const c = prompt('New country / office name (e.g. Syria – Country office)'); if (c && c.trim()) { const name = c.trim(); if (!settings.countries.includes(name)) updateSettings({ countries: [...settings.countries, name] }); setEdit({ ...edit, country: name }) } return } setEdit({ ...edit, country: e.target.value }) }}>{settings.countries.map((c) => <option key={c}>{c}</option>)}{edit.country && !settings.countries.includes(edit.country) && <option>{edit.country}</option>}<option value="__new">+ Add a new country…</option></select></Field>
            <Field label="Line manager" hint="First approver on this person's requisitions, leave and WFH requests."><select className="input" data-testid="org-manager" value={edit.lineManagerId ?? ''} onChange={(e) => setEdit({ ...edit, lineManagerId: e.target.value || undefined })}><option value="">— none (top of the chart) —</option>{active.filter((s) => s.id !== edit.id && !(edit.id && isDesc(s.id, edit.id))).map((s) => <option key={s.id} value={s.id}>{s.name || '(to recruit)'} · {s.position}</option>)}</select></Field>
            <Field label="Platform account" hint="Needed for the person to approve on the system."><select className="input" data-testid="org-account" value={edit.userId ?? ''} onChange={(e) => setEdit({ ...edit, userId: e.target.value || undefined })}><option value="">— none —</option>{users.filter((u) => u.active && (!staff.some((s) => s.userId === u.id && s.id !== edit.id))).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</select></Field>
            <Field label="Position status" hint={edit.status === 'planned' ? 'Vacant — shown amber; no name needed.' : edit.status === 'left' ? 'Left — hidden from the organogram and the master budget.' : 'Hired — enter the person’s name.'}><select className="input" data-testid="org-status" value={edit.status ?? 'active'} onChange={(e) => setEdit({ ...edit, status: e.target.value as StaffStatus })}><option value="active">Hired</option><option value="planned">Vacant — to recruit</option><option value="left">Left the organisation</option></select></Field>
            <div className="rounded-card border border-line bg-surface-muted p-3 sm:col-span-2">
              <div className="mb-3"><Field label="Held in acting capacity by" hint="Choose a colleague when this position is covered temporarily — shown light green with their name; they keep their own record and salary."><select className="input" data-testid="org-acting" value={edit.actingStaffId ?? ''} onChange={(e) => setEdit({ ...edit, actingStaffId: e.target.value || undefined, acting: !!e.target.value })}><option value="">— no, the position is {edit.status === 'planned' ? 'vacant' : 'filled by its own holder'} —</option>{active.filter((s) => s.id !== edit.id && s.name.trim() && !s.actingStaffId).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.position}</option>)}</select></Field></div>
              <div className="mb-3 rounded-card border border-dashed border-amber-700/50 bg-amber-50/40 p-3">
                <div className="mb-1 text-[12.5px] font-semibold text-ink-900">Planned team — positions to recruit under this one</div>
                <div className="mb-2 text-[11.5px] text-ink-500">Shown on the organogram as a dashed box (e.g. 6 × Rehabilitation Assistant). No staff records or RHS numbers until each person is hired — then add them as positions under this one.</div>
                {(edit.plannedTeam ?? []).map((t, i) => <div key={i} className="mb-1 flex items-center gap-2"><input type="number" min={1} className="input no-spin w-16 px-1.5" data-testid={`org-plan-count-${i}`} value={t.count} onChange={(e) => setEdit({ ...edit, plannedTeam: (edit.plannedTeam ?? []).map((x, j) => (j === i ? { ...x, count: Number(e.target.value) || 0 } : x)) })} /><span className="text-ink-500">×</span><input className="input flex-1" data-testid={`org-plan-pos-${i}`} value={t.position} placeholder="Position" onChange={(e) => setEdit({ ...edit, plannedTeam: (edit.plannedTeam ?? []).map((x, j) => (j === i ? { ...x, position: e.target.value } : x)) })} /><button className="btn-ghost btn-sm text-accent-700" onClick={() => setEdit({ ...edit, plannedTeam: (edit.plannedTeam ?? []).filter((_, j) => j !== i) })}><Trash2 size={13} /></button></div>)}
                <button className="btn-secondary btn-sm" data-testid="org-plan-add" onClick={() => setEdit({ ...edit, plannedTeam: [...(edit.plannedTeam ?? []), { position: '', count: 1 }] })}><Plus size={13} /> Add planned positions</button>
              </div>
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-900"><input type="checkbox" data-testid="org-holder" checked={!!edit.budgetHolder} onChange={(e) => setEdit({ ...edit, budgetHolder: e.target.checked, approvalLimitUSD: e.target.checked ? edit.approvalLimitUSD : undefined })} /> Budget holder</label>
              <div className="mt-1 text-[11.5px] text-ink-500">Budget holders own master-budget lines and approve what their reports request.</div>
              {edit.budgetHolder && <div className="mt-3"><Field label="Approval limit (USD)" hint="Requisitions above this amount also go to the next manager up the chart. Leave empty for no limit."><input type="number" className="input" data-testid="org-limit" value={edit.approvalLimitUSD ?? ''} placeholder="no limit" onChange={(e) => setEdit({ ...edit, approvalLimitUSD: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field></div>}
            </div>
            <div className="text-[11.5px] text-ink-500 sm:col-span-2">Contract, salary and leave entitlements are edited on the <Link to="/hr/staff" className="text-brand-700 hover:underline">staff register</Link>.</div>
          </div>
        )}
      </Modal>
    </>
  )
}
