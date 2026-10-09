import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Landmark, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Stat } from '@/components/ui'
import { balances, contractDaysLeft, hrSettings } from '@/lib/hr'
import { STAFF_STATUS_LABEL, STAFF_STATUS_TONE, CONTRACT_LABEL, nextRhsNumber } from '@/lib/salary'
import { fmtDate, cx } from '@/lib/format'
import { useHrContext } from './shared'
import type { StaffMember, StaffStatus, Currency } from '@/types'

export default function HrStaff() {
  const { hrManage, visibleStaff } = useHrContext()
  const { staff, leaveRequests, settings, users, upsertStaff } = useStore()
  const hr = hrSettings(settings)
  const [edit, setEdit] = useState<Partial<StaffMember> | null>(null)
  const [q, setQ] = useState('')
  const list = visibleStaff.filter((s) => !q || [s.rhsNumber, s.name, s.position, s.department].join(' ').toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.rhsNumber.localeCompare(b.rhsNumber))
  const ending = staff.filter((s) => s.status === 'active' && contractDaysLeft(s) !== null && contractDaysLeft(s)! <= 60 && contractDaysLeft(s)! >= 0)
  return (
    <>
      <PageHeader title="Staff register" subtitle="Contracts, line managers and leave / work-from-home balances. Salaries and project coverage live on the master salary plan."
        actions={<div className="flex gap-2"><Link to="/finance/salary-plan" className="btn-secondary"><Landmark size={15} /> Master salary plan</Link>{hrManage && <button className="btn-primary" onClick={() => setEdit({ rhsNumber: nextRhsNumber(staff), status: 'active', contractType: 'full_time', currency: settings.defaultCurrency, country: settings.countries[0], startDate: new Date().toISOString().slice(0, 10) })}><Plus size={15} /> Add staff</button>}</div>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Stat label="Active staff" value={staff.filter((s) => s.status === 'active').length} tone="brand" /><Stat label="Contracts ending within 60 days" value={ending.length} hint={ending.map((s) => s.name).join(', ') || undefined} tone={ending.length ? 'accent' : 'default'} /><Stat label="Entitlements" value={`${hr.annualLeaveDays} + ${hr.wfhDays}`} hint="annual leave days + work-from-home days per year" /></div>
      <input className="input mb-3 w-72" placeholder="Search RHS no., name, position…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card padded={false}><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-[13px]">
        <thead><tr><th className="table-th w-24">RHS no.</th><th className="table-th">Staff</th><th className="table-th">Line manager</th><th className="table-th">Contract</th><th className="table-th">Start</th><th className="table-th">End</th><th className="table-th w-40">Annual leave</th><th className="table-th w-36">WFH</th><th className="table-th">Status</th><th className="table-th w-12" /></tr></thead>
        <tbody>{list.map((s) => { const b = balances(s, leaveRequests, settings); const left = contractDaysLeft(s); const mgr = staff.find((x) => x.id === s.lineManagerId); return (
          <tr key={s.id} className="hover:bg-surface-muted">
            <td className="table-td font-mono text-[12px] text-brand-700">{s.rhsNumber}</td>
            <td className="table-td"><div className="font-medium text-ink-900">{s.name || <i className="text-ink-500">to recruit</i>}</div><div className="text-[12px] text-ink-500">{s.position} · {s.department}</div></td>
            <td className="table-td text-ink-700">{mgr?.name ?? '—'}</td>
            <td className="table-td text-ink-700">{CONTRACT_LABEL[s.contractType]}{s.contractRef && <div className="font-mono text-[11px] text-ink-500">{s.contractRef}</div>}</td>
            <td className="table-td">{fmtDate(s.startDate)}</td>
            <td className="table-td">{s.endDate ? <span className={cx(left !== null && left <= 60 && left >= 0 && 'font-semibold text-accent-700')}>{fmtDate(s.endDate)}{left !== null && left >= 0 && left <= 60 && <AlertTriangle size={12} className="ml-1 inline" />}</span> : <span className="text-ink-400">open-ended</span>}</td>
            <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className="h-full rounded-pill bg-brand-600" style={{ width: `${b.annual.entitlement ? (b.annual.used / b.annual.entitlement) * 100 : 0}%` }} /></div><span className="text-[12px]"><b>{b.annual.remaining}</b>/{b.annual.entitlement}</span></div></td>
            <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className="h-full rounded-pill bg-info-500" style={{ width: `${b.wfh.entitlement ? (b.wfh.used / b.wfh.entitlement) * 100 : 0}%` }} /></div><span className="text-[12px]"><b>{b.wfh.remaining}</b>/{b.wfh.entitlement}</span></div></td>
            <td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', STAFF_STATUS_TONE[s.status])}>{STAFF_STATUS_LABEL[s.status]}</span></td>
            <td className="table-td">{hrManage && <button className="btn-ghost btn-sm" onClick={() => setEdit(s)}><Pencil size={13} /></button>}</td>
          </tr>) })}</tbody></table></div></Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} width="max-w-3xl" title={edit?.id ? `Edit ${edit.rhsNumber}` : 'Add staff'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!edit?.position?.trim()) return alert('Position is required.'); upsertStaff({ ...edit, position: edit.position!.trim() }); setEdit(null) }}>Save</button></>}>
        {edit && <div className="grid gap-4 sm:grid-cols-3">
          <Field label="RHS number" required><input className="input font-mono" value={edit.rhsNumber ?? ''} onChange={(e) => setEdit({ ...edit, rhsNumber: e.target.value })} /></Field>
          <Field label="Full name" className="sm:col-span-2"><input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Position" required className="sm:col-span-2"><input className="input" value={edit.position ?? ''} onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></Field>
          <Field label="Status"><select className="input" value={edit.status ?? 'active'} onChange={(e) => setEdit({ ...edit, status: e.target.value as StaffStatus })}>{(['active', 'planned', 'left'] as StaffStatus[]).map((s) => <option key={s} value={s}>{STAFF_STATUS_LABEL[s]}</option>)}</select></Field>
          <Field label="Department"><input className="input" value={edit.department ?? ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></Field>
          <Field label="Country"><input className="input" list="hr-countries" value={edit.country ?? ''} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /><datalist id="hr-countries">{settings.countries.map((c) => <option key={c} value={c} />)}</datalist></Field>
          <Field label="Line manager"><select className="input" value={edit.lineManagerId ?? ''} onChange={(e) => setEdit({ ...edit, lineManagerId: e.target.value || undefined })}><option value="">—</option>{staff.filter((s) => s.id !== edit.id && s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name} · {s.position}</option>)}</select></Field>
          <Field label="Platform account"><select className="input" value={edit.userId ?? ''} onChange={(e) => setEdit({ ...edit, userId: e.target.value || undefined })}><option value="">— none —</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Contract type"><select className="input" value={edit.contractType ?? 'full_time'} onChange={(e) => setEdit({ ...edit, contractType: e.target.value as StaffMember['contractType'] })}>{(Object.keys(CONTRACT_LABEL) as StaffMember['contractType'][]).map((c) => <option key={c} value={c}>{CONTRACT_LABEL[c]}</option>)}</select></Field>
          <Field label="Contract ref."><input className="input" value={edit.contractRef ?? ''} onChange={(e) => setEdit({ ...edit, contractRef: e.target.value })} /></Field>
          <Field label="Contract start" required><input type="date" className="input" value={edit.startDate ?? ''} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></Field>
          <Field label="Contract end"><input type="date" className="input" value={edit.endDate ?? ''} onChange={(e) => setEdit({ ...edit, endDate: e.target.value || undefined })} /></Field>
          <Field label="Monthly salary"><div className="flex gap-2"><input type="number" className="input" value={edit.monthlySalary ?? 0} onChange={(e) => setEdit({ ...edit, monthlySalary: Number(e.target.value) })} /><select className="input w-24" value={edit.currency ?? settings.defaultCurrency} onChange={(e) => setEdit({ ...edit, currency: e.target.value as Currency })}><option>JOD</option><option>USD</option><option>EUR</option></select></div></Field>
          <Field label={`Annual leave days / year (default ${hr.annualLeaveDays})`}><input type="number" className="input" value={edit.annualLeaveDays ?? ''} placeholder={String(hr.annualLeaveDays)} onChange={(e) => setEdit({ ...edit, annualLeaveDays: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label={`WFH days / year (default ${hr.wfhDays})`}><input type="number" className="input" value={edit.wfhDays ?? ''} placeholder={String(hr.wfhDays)} onChange={(e) => setEdit({ ...edit, wfhDays: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Notes" className="sm:col-span-3"><input className="input" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
        </div>}
      </Modal>
    </>
  )
}
