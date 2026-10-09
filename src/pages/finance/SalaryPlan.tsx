import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, Pencil, Trash2, UserCheck, Users, AlertTriangle } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat, Modal, Field, Alert } from '@/components/ui'
import { accessOf } from '@/lib/departments'
import { staffCoverage, staffMonthly, exportSalaryPlan, STAFF_STATUS_LABEL, STAFF_STATUS_TONE, CONTRACT_LABEL, nextRhsNumber } from '@/lib/salary'
import type { StaffCoverage } from '@/lib/salary'
import { monthLabel } from '@/lib/grants'
import { fmtMoney, fmtDate, cx } from '@/lib/format'
import type { StaffMember, StaffStatus, Currency } from '@/types'

type Tab = 'coverage' | 'plan' | 'register'

export default function SalaryPlanPage() {
  const user = useCurrentUser()!
  const { staff, budgets, projects, settings, country, upsertStaff, deleteStaff, confirmRecruitment } = useStore()
  const fin = accessOf(user, 'finance'), hr = accessOf(user, 'hr')
  const canEdit = user.role === 'admin' || fin === 'manage' || hr === 'manage'
  const years = useMemo(() => { const y = new Date().getFullYear(); return [y - 1, y, y + 1, y + 2] }, [])
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState<Tab>('coverage')
  const [status, setStatus] = useState<StaffStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [drill, setDrill] = useState<StaffCoverage | null>(null)
  const [edit, setEdit] = useState<Partial<StaffMember> | null>(null)
  const [fill, setFill] = useState<{ st: StaffMember; name: string; startDate: string } | null>(null)
  const ccy: Currency = settings.defaultCurrency

  const list = staff.filter((s) => country === 'all' || s.country === country).filter((s) => status === 'all' || s.status === status)
    .filter((s) => !q || [s.rhsNumber, s.name, s.position, s.department].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.rhsNumber.localeCompare(b.rhsNumber))
  const cov = useMemo(() => staffCoverage(list, budgets, projects, year, settings), [list, budgets, projects, year, settings])
  const annual = cov.reduce((s, c) => s + c.annual, 0), covered = cov.reduce((s, c) => s + c.covered, 0), pipeline = cov.reduce((s, c) => s + c.pipeline, 0)
  const planned = staff.filter((s) => s.status === 'planned')
  const under = cov.filter((c) => c.staff.status !== 'left' && c.annual > 0 && c.pct < 100).length
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  return (
    <>
      <PageHeader eyebrow="Finance · HR & Admin" title="Master salary plan" subtitle="Every staff member by RHS number, which project budget lines pay their salary, how much of each salary is covered in the year, and the month-by-month salary spending plan."
        actions={<div className="flex flex-wrap gap-2"><select className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select><button className="btn-secondary" onClick={() => exportSalaryPlan(cov, year, settings, user.name)}><Download size={15} /> Export (Excel)</button>{canEdit && <button className="btn-primary" onClick={() => setEdit({ rhsNumber: nextRhsNumber(staff), status: 'active', contractType: 'full_time', currency: ccy, country: settings.countries[0], startDate: `${year}-01-01` })}><Plus size={15} /> Add staff</button>}</div>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Staff on the plan" value={list.filter((s) => s.status !== 'left').length} hint={`${planned.length} new position(s) to recruit`} tone="brand" icon={<Users size={16} />} />
        <Stat label={`Annual payroll ${year}`} value={fmtMoney(annual, ccy)} />
        <Stat label="Covered by active projects" value={`${annual ? Math.round((covered / annual) * 100) : 0}%`} hint={fmtMoney(covered, ccy)} tone={annual && covered / annual < 0.7 ? 'accent' : 'brand'} />
        <Stat label="Funding gap" value={fmtMoney(Math.max(0, annual - covered), ccy)} hint={pipeline ? `pipeline (proposals) ${fmtMoney(pipeline, ccy)}` : undefined} tone={annual - covered > 0 ? 'sun' : 'default'} />
        <Stat label="Staff under 100% covered" value={under} tone={under ? 'accent' : 'default'} />
      </div>
      {planned.length > 0 && <div className="mb-5"><Alert tone="warning"><AlertTriangle size={14} className="mr-1 inline" /> {planned.length} position(s) created from approved project budgets are waiting to be filled: {planned.map((s) => `${s.rhsNumber} ${s.position} (${s.sourceProjectCode})`).join(' · ')}. {canEdit && 'Use "Fill position" on the register once recruited.'}</Alert></div>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 border-b border-line">{([['coverage', 'Salary coverage'], ['plan', 'Spending plan'], ['register', 'Staff register']] as [Tab, string][]).map(([t, l]) => <button key={t} className={cx('-mb-px border-b-2 px-3 py-2 text-[13px] font-medium', tab === t ? 'border-brand-600 text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-800')} onClick={() => setTab(t)}>{l}</button>)}</div>
        <div className="flex gap-2"><input className="input w-56" placeholder="Search RHS no., name, position…" value={q} onChange={(e) => setQ(e.target.value)} /><select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value as StaffStatus | 'all')}><option value="all">All statuses</option>{(['active', 'planned', 'left'] as StaffStatus[]).map((s) => <option key={s} value={s}>{STAFF_STATUS_LABEL[s]}</option>)}</select></div>
      </div>

      {tab === 'coverage' && (
        <Card padded={false}><div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[1150px] text-[13px]">
          <thead><tr><th className="table-th w-24">RHS no.</th><th className="table-th">Staff · position</th><th className="table-th">Dept · country</th><th className="table-th text-right">Monthly</th><th className="table-th text-right">Annual {year}</th><th className="table-th w-44">Covered by projects</th><th className="table-th text-right">LoE</th><th className="table-th text-right">Gap</th><th className="table-th">Projects covering</th></tr></thead>
          <tbody>{cov.map((c) => { const s = c.staff; return (
            <tr key={s.id} className={cx('cursor-pointer hover:bg-surface-muted', s.status === 'left' && 'opacity-60')} onClick={() => setDrill(c)}>
              <td className="table-td font-mono text-[12px] text-brand-700">{s.rhsNumber}</td>
              <td className="table-td"><div className="font-medium text-ink-900">{s.name || <span className="italic text-ink-500">to recruit</span>} <span className={cx('ml-1 rounded-pill px-1.5 py-0.5 text-[10.5px] font-semibold', STAFF_STATUS_TONE[s.status])}>{STAFF_STATUS_LABEL[s.status]}</span></div><div className="text-[12px] text-ink-500">{s.position}</div></td>
              <td className="table-td text-[12.5px] text-ink-700">{s.department}<div className="text-ink-500">{s.country}</div></td>
              <td className="table-td text-right tabular-nums">{fmtMoney(s.monthlySalary, s.currency)}</td>
              <td className="table-td text-right tabular-nums">{fmtMoney(c.annual, s.currency)}</td>
              <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-pill bg-ink-100"><div className={cx('h-full', c.pct >= 100 ? 'bg-brand-600' : c.pct >= 70 ? 'bg-sun-500' : 'bg-accent-600')} style={{ width: `${Math.min(100, c.pct)}%` }} /></div><span className="w-10 text-right text-[12px] font-semibold">{c.pct}%</span></div><div className="text-[11.5px] text-ink-500">{fmtMoney(c.covered, s.currency)} · {c.projects} project(s){c.pipeline ? ` · +${fmtMoney(c.pipeline, s.currency)} pipeline` : ''}</div></td>
              <td className="table-td text-right tabular-nums"><span className={cx(c.loe > 100 && 'font-semibold text-accent-700')}>{c.loe}%</span></td>
              <td className="table-td text-right tabular-nums">{c.gap ? <span className="text-accent-700">{fmtMoney(c.gap, s.currency)}</span> : <span className="text-brand-700">—</span>}</td>
              <td className="table-td" onClick={(e) => e.stopPropagation()}><div className="flex flex-wrap gap-1">{c.lines.filter((l) => l.status !== 'closed').map((l, i) => <Link key={i} to={l.project ? `/grants/${l.project.id}?tab=budget` : `/budgets/${l.budget.id}`} className={cx('rounded-pill border px-2 py-0.5 text-[11px] font-medium hover:bg-brand-50', l.status === 'active' ? 'border-line text-ink-800' : 'border-dashed border-ink-300 text-ink-500')} title={`${l.line.code} · ${l.line.description}`}>{l.budget.donorCode} · {l.line.code} · {Math.round((l.line.pct ?? 1) * 100 * l.share)}%</Link>)}{c.lines.length === 0 && <span className="text-[11.5px] text-ink-400">unfunded</span>}</div></td>
            </tr>) })}</tbody>
          <tfoot><tr className="bg-surface-muted font-semibold"><td className="table-td" colSpan={4}>Total</td><td className="table-td text-right tabular-nums">{fmtMoney(annual, ccy)}</td><td className="table-td">{annual ? Math.round((covered / annual) * 100) : 0}% · {fmtMoney(covered, ccy)}</td><td className="table-td" /><td className="table-td text-right tabular-nums text-accent-700">{fmtMoney(Math.max(0, annual - covered), ccy)}</td><td className="table-td" /></tr></tfoot>
        </table></div></Card>
      )}

      {tab === 'plan' && (
        <Card padded={false} title={`Salary spending plan ${year}`} description="Monthly salary charged to each project (from the project spending plans; lines without a plan are spread evenly). Red cells are months where the salary is not fully covered.">
          <div className="overflow-x-auto scrollbar-thin"><table className="w-full text-[12px]" style={{ minWidth: 520 + months.length * 86 }}>
            <thead><tr><th className="table-th sticky left-0 z-10 bg-surface-muted min-w-[240px]">Staff</th><th className="table-th text-right">Monthly</th>{months.map((m) => <th key={m} className="table-th text-right">{monthLabel(m)}</th>)}<th className="table-th text-right">Covered</th><th className="table-th text-right">Salary</th><th className="table-th text-right">Gap</th></tr></thead>
            <tbody>{cov.map((c) => { const m = staffMonthly(c, year, settings); const tc = m.reduce((s, x) => s + x.covered, 0), ts = m.reduce((s, x) => s + x.salary, 0); return (
              <tr key={c.staff.id} className="border-t border-line hover:bg-surface-muted">
                <td className="sticky left-0 z-10 bg-surface px-3 py-1.5"><span className="font-mono text-[11px] text-brand-700">{c.staff.rhsNumber}</span> <span className="text-ink-900">{c.staff.name || <i className="text-ink-500">to recruit</i>}</span><div className="text-[11px] text-ink-500">{c.staff.position}</div></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{c.staff.monthlySalary.toLocaleString()}</td>
                {m.map((x) => <td key={x.period} className={cx('px-2 py-1.5 text-right tabular-nums', x.salary > 0 && x.covered < x.salary - 0.5 ? 'bg-accent-50 text-accent-700' : x.covered > 0 ? 'text-ink-800' : 'text-ink-300')} title={x.byProject.map((b) => `${b.code}: ${Math.round(b.amount).toLocaleString()}`).join('\n') || (x.salary ? 'not covered' : 'outside contract')}>{x.covered ? Math.round(x.covered).toLocaleString() : x.salary ? '0' : '·'}</td>)}
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{Math.round(tc).toLocaleString()}</td><td className="px-2 py-1.5 text-right tabular-nums">{ts.toLocaleString()}</td><td className={cx('px-2 py-1.5 text-right tabular-nums', ts - tc > 0.5 && 'text-accent-700')}>{Math.round(Math.max(0, ts - tc)).toLocaleString()}</td>
              </tr>) })}</tbody>
            <tfoot><tr className="bg-surface-muted font-semibold"><td className="sticky left-0 z-10 bg-surface-muted px-3 py-1.5">TOTAL</td><td className="px-2 py-1.5 text-right tabular-nums">{list.reduce((s, x) => s + (x.status !== 'left' ? x.monthlySalary : 0), 0).toLocaleString()}</td>{months.map((mm, i) => { const t = cov.reduce((s, c) => s + staffMonthly(c, year, settings)[i]!.covered, 0); return <td key={mm} className="px-2 py-1.5 text-right tabular-nums">{Math.round(t).toLocaleString()}</td> })}<td className="px-2 py-1.5 text-right tabular-nums">{Math.round(covered).toLocaleString()}</td><td className="px-2 py-1.5 text-right tabular-nums">{annual.toLocaleString()}</td><td className="px-2 py-1.5 text-right tabular-nums text-accent-700">{Math.round(Math.max(0, annual - covered)).toLocaleString()}</td></tr></tfoot>
          </table></div>
        </Card>
      )}

      {tab === 'register' && (
        <Card padded={false}><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]">
          <thead><tr><th className="table-th w-24">RHS no.</th><th className="table-th">Name</th><th className="table-th">Position</th><th className="table-th">Department</th><th className="table-th">Country</th><th className="table-th">Contract</th><th className="table-th text-right">Monthly salary</th><th className="table-th">Start · end</th><th className="table-th">Status</th><th className="table-th">Source</th><th className="table-th w-28" /></tr></thead>
          <tbody>{list.map((s) => (
            <tr key={s.id} className="hover:bg-surface-muted">
              <td className="table-td font-mono text-[12px] text-brand-700">{s.rhsNumber}</td><td className="table-td font-medium text-ink-900">{s.name || <span className="italic text-ink-500">to recruit</span>}</td><td className="table-td">{s.position}</td><td className="table-td text-ink-700">{s.department}</td><td className="table-td text-ink-700">{s.country}</td><td className="table-td text-ink-700">{CONTRACT_LABEL[s.contractType]}</td>
              <td className="table-td text-right tabular-nums">{fmtMoney(s.monthlySalary, s.currency)}</td><td className="table-td text-[12px] text-ink-600">{fmtDate(s.startDate)}{s.endDate && ` – ${fmtDate(s.endDate)}`}</td>
              <td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', STAFF_STATUS_TONE[s.status])}>{STAFF_STATUS_LABEL[s.status]}</span></td>
              <td className="table-td text-[12px]">{s.sourceProjectId ? <Link to={`/grants/${s.sourceProjectId}?tab=budget`} className="text-brand-700 hover:underline">{s.sourceProjectCode} · {s.sourceLineCode}</Link> : <span className="text-ink-400">core</span>}</td>
              <td className="table-td"><div className="flex justify-end gap-1">{canEdit && s.status === 'planned' && <button className="btn-primary btn-sm" title="Record the recruited person" onClick={() => setFill({ st: s, name: '', startDate: s.startDate })}><UserCheck size={13} /> Fill</button>}{canEdit && <button className="btn-ghost btn-sm" onClick={() => setEdit(s)}><Pencil size={13} /></button>}{canEdit && <button className="btn-ghost btn-sm text-accent-700" onClick={() => { if (confirm(`Remove ${s.rhsNumber} ${s.name || s.position} from the salary plan? Project lines paying this person will be unlinked.`)) deleteStaff(s.id) }}><Trash2 size={13} /></button>}</div></td>
            </tr>))}</tbody>
        </table></div></Card>
      )}

      {/* Drill-down */}
      <Modal open={!!drill} onClose={() => setDrill(null)} width="max-w-3xl" title={drill ? `${drill.staff.rhsNumber} · ${drill.staff.name || drill.staff.position} — salary coverage ${year}` : ''} footer={<button className="btn-secondary" onClick={() => setDrill(null)}>Close</button>}>
        {drill && (
          <div className="space-y-3 text-[13px]">
            <div className="grid gap-3 sm:grid-cols-4"><Stat label="Annual cost" value={fmtMoney(drill.annual, drill.staff.currency)} /><Stat label="Covered" value={`${drill.pct}%`} hint={fmtMoney(drill.covered, drill.staff.currency)} tone="brand" /><Stat label="LoE allocated" value={`${drill.loe}%`} tone={drill.loe > 100 ? 'accent' : 'default'} /><Stat label="Gap" value={fmtMoney(drill.gap, drill.staff.currency)} tone={drill.gap ? 'sun' : 'default'} /></div>
            <table className="w-full text-[12.5px]"><thead><tr><th className="table-th">Project</th><th className="table-th">Budget line</th><th className="table-th text-right">LoE</th><th className="table-th text-right">Line share</th><th className="table-th text-right">Prorated {year}</th><th className="table-th">Status</th></tr></thead>
              <tbody>{drill.lines.length === 0 && <tr><td colSpan={6} className="table-td text-ink-500">No project budget line pays this salary — link one on the project's Budget tab (Staff · RHS no. column).</td></tr>}{drill.lines.map((l, i) => <tr key={i}><td className="table-td"><Link to={l.project ? `/grants/${l.project.id}?tab=budget` : `/budgets/${l.budget.id}`} className="font-medium text-brand-700 hover:underline">{l.budget.donorCode}</Link><div className="text-[11.5px] text-ink-500">{l.budget.name}</div></td><td className="table-td"><span className="font-mono text-[11.5px]">{l.line.code}</span> {l.line.description}{l.share < 1 && <span className="text-ink-500"> · 1 of {Math.round(1 / l.share)}</span>}</td><td className="table-td text-right">{Math.round((l.line.pct ?? 1) * 100)}%</td><td className="table-td text-right tabular-nums">{fmtMoney(l.amount, drill.staff.currency)}</td><td className="table-td text-right tabular-nums">{fmtMoney(l.prorated, drill.staff.currency)}</td><td className="table-td">{l.status === 'active' ? <span className="rounded-pill bg-brand-100 px-2 text-[11px] font-semibold text-brand-800">funded</span> : l.status === 'draft' ? <span className="rounded-pill bg-sun-100 px-2 text-[11px] font-semibold text-sun-700">pipeline</span> : <span className="rounded-pill bg-ink-100 px-2 text-[11px] text-ink-500">closed</span>}</td></tr>)}</tbody></table>
            {drill.loe > 100 && <Alert tone="danger">Level of effort across active projects exceeds 100% — the allocation needs correcting before donor reporting.</Alert>}
          </div>
        )}
      </Modal>

      {/* Add / edit staff */}
      <Modal open={!!edit} onClose={() => setEdit(null)} width="max-w-2xl" title={edit?.id ? `Edit ${edit.rhsNumber}` : 'Add staff to the master salary plan'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!edit?.position?.trim()) return alert('Position is required.'); if (edit.status !== 'planned' && !edit.name?.trim()) return alert('Name is required (or set the status to "New — to recruit").'); upsertStaff({ ...edit, position: edit.position!.trim() }); setEdit(null) }}>Save</button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="RHS number" required><input className="input font-mono" value={edit.rhsNumber ?? ''} onChange={(e) => setEdit({ ...edit, rhsNumber: e.target.value })} /></Field>
            <Field label="Full name" className="sm:col-span-2"><input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={edit.status === 'planned' ? 'Leave blank until recruited' : ''} /></Field>
            <Field label="Position" required className="sm:col-span-2"><input className="input" value={edit.position ?? ''} onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></Field>
            <Field label="Status"><select className="input" value={edit.status ?? 'active'} onChange={(e) => setEdit({ ...edit, status: e.target.value as StaffStatus })}>{(['active', 'planned', 'left'] as StaffStatus[]).map((s) => <option key={s} value={s}>{STAFF_STATUS_LABEL[s]}</option>)}</select></Field>
            <Field label="Department"><input className="input" value={edit.department ?? ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></Field>
            <Field label="Country"><input className="input" list="stf-countries" value={edit.country ?? ''} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /><datalist id="stf-countries">{settings.countries.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label="Contract"><select className="input" value={edit.contractType ?? 'full_time'} onChange={(e) => setEdit({ ...edit, contractType: e.target.value as StaffMember['contractType'] })}>{(Object.keys(CONTRACT_LABEL) as StaffMember['contractType'][]).map((c) => <option key={c} value={c}>{CONTRACT_LABEL[c]}</option>)}</select></Field>
            <Field label="Monthly salary (gross cost)" required><div className="flex gap-2"><input type="number" className="input" value={edit.monthlySalary ?? 0} onChange={(e) => setEdit({ ...edit, monthlySalary: Number(e.target.value) })} /><select className="input w-24" value={edit.currency ?? ccy} onChange={(e) => setEdit({ ...edit, currency: e.target.value as Currency })}><option>JOD</option><option>USD</option><option>EUR</option></select></div></Field>
            <Field label="Start date"><input type="date" className="input" value={edit.startDate ?? ''} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></Field>
            <Field label="End date (if fixed term)"><input type="date" className="input" value={edit.endDate ?? ''} onChange={(e) => setEdit({ ...edit, endDate: e.target.value || undefined })} /></Field>
            <Field label="Notes" className="sm:col-span-3"><input className="input" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* Fill a planned position */}
      <Modal open={!!fill} onClose={() => setFill(null)} title={fill ? `Fill position ${fill.st.rhsNumber} — ${fill.st.position}` : ''} footer={<><button className="btn-secondary" onClick={() => setFill(null)}>Cancel</button><button className="btn-primary" disabled={!fill?.name.trim()} onClick={() => { if (fill) confirmRecruitment(fill.st.id, fill.name.trim(), fill.startDate); setFill(null) }}><UserCheck size={14} /> Confirm recruitment</button></>}>
        {fill && <div className="space-y-3"><p className="text-[13px] text-ink-600">Created from approved budget <b>{fill.st.sourceProjectCode}</b> line <b>{fill.st.sourceLineCode}</b>. The RHS number stays the same; the person becomes active on the plan.</p><Field label="Recruited person" required><input className="input" autoFocus value={fill.name} onChange={(e) => setFill({ ...fill, name: e.target.value })} /></Field><Field label="Start date"><input type="date" className="input" value={fill.startDate} onChange={(e) => setFill({ ...fill, startDate: e.target.value })} /></Field></div>}
      </Modal>
    </>
  )
}
