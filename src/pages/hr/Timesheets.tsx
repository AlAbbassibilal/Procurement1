import { useState } from 'react'
import { Plus, Trash2, Wand2, Download, Send, Check, Undo2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Alert, Stat } from '@/components/ui'
import { hrSettings, workingDaysInMonth, requestDaysInMonth, suggestTimesheet, timesheetTotal, exportTimesheet, TS_STATUS_LABEL, TS_STATUS_TONE } from '@/lib/hr'
import { monthLabel } from '@/lib/grants'
import { fmtDateTime, cx, uid } from '@/lib/format'
import { useHrContext } from './shared'
import type { Timesheet, TimesheetLine, StaffMember } from '@/types'

export default function HrTimesheets() {
  const { me, hrManage, canActOn, visibleStaff } = useHrContext()
  const { timesheets, leaveRequests, settings, projects, budgets, upsertTimesheet, setTimesheetStatus } = useStore()
  const hr = hrSettings(settings)
  const ym = (o: number) => { const x = new Date(); x.setMonth(x.getMonth() + o); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
  const [period, setPeriod] = useState(ym(-1))
  const [edit, setEdit] = useState<{ st: StaffMember; t: Timesheet } | null>(null)
  const [ret, setRet] = useState<Timesheet | null>(null)
  const [note, setNote] = useState('')
  const periods = [ym(-3), ym(-2), ym(-1), ym(0), ym(1)]
  const rows = visibleStaff.filter((s) => s.status === 'active' && s.id !== me?.id || hrManage && s.status === 'active').map((s) => ({ s, t: timesheets.find((t) => t.staffId === s.id && t.period === period) }))
  const leaveFor = (s: StaffMember) => leaveRequests.filter((r) => r.staffId === s.id && r.status === 'approved' && r.type !== 'wfh').reduce((n, r) => n + requestDaysInMonth(r, period, hr.weekend), 0)
  const open = (s: StaffMember, t?: Timesheet) => {
    const wd = workingDaysInMonth(period, hr.weekend)
    const base: Timesheet = t ?? { id: '', staffId: s.id, period, workingDays: wd, leaveDays: leaveFor(s), lines: suggestTimesheet(s, budgets, projects, period, wd - leaveFor(s)), status: 'draft', createdBy: '', createdByName: '', createdAt: '', updatedAt: '' }
    setEdit({ st: s, t: { ...base, lines: base.lines.map((l) => ({ ...l })) } })
  }
  const setLine = (id: string, patch: Partial<TimesheetLine>) => setEdit((e) => e && ({ ...e, t: { ...e.t, lines: e.t.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } }))
  const total = edit ? timesheetTotal(edit.t) + edit.t.leaveDays : 0
  const save = (submit: boolean) => {
    if (!edit) return
    if (submit && Math.abs(total - edit.t.workingDays) > 0.01) return alert(`Allocated ${total} day(s) but the month has ${edit.t.workingDays} working days — adjust before submitting.`)
    const saved = upsertTimesheet({ ...(edit.t.id ? { id: edit.t.id } : {}), staffId: edit.st.id, period, workingDays: edit.t.workingDays, leaveDays: edit.t.leaveDays, lines: edit.t.lines, note: edit.t.note })
    if (submit) setTimesheetStatus(saved.id, 'submitted')
    setEdit(null)
  }
  const projectOpts = projects.filter((p) => ['granted', 'active'].includes(p.stage))
  return (
    <>
      <PageHeader title="Timesheets" subtitle="Prepared each month by the line manager, allocating the working days to the projects that fund the position; the staff member acknowledges, HR approves."
        actions={<select className="input w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>{periods.map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}</select>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-4"><Stat label={`Working days · ${monthLabel(period)}`} value={workingDaysInMonth(period, hr.weekend)} /><Stat label="Not started" value={rows.filter((r) => !r.t).length} tone={rows.some((r) => !r.t) ? 'sun' : 'default'} /><Stat label="Awaiting staff / approval" value={rows.filter((r) => r.t && ['submitted', 'acknowledged'].includes(r.t.status)).length} /><Stat label="Approved" value={rows.filter((r) => r.t?.status === 'approved').length} tone="brand" /></div>
      <Card padded={false}><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]">
        <thead><tr><th className="table-th">Staff</th><th className="table-th">Allocation</th><th className="table-th text-right">Days</th><th className="table-th">Status</th><th className="table-th">Prepared by</th><th className="table-th w-72" /></tr></thead>
        <tbody>{rows.length === 0 && <tr><td colSpan={6} className="table-td text-ink-500">No staff to prepare timesheets for.</td></tr>}{rows.map(({ s, t }) => (
          <tr key={s.id} className="hover:bg-surface-muted"><td className="table-td"><div className="font-medium text-ink-900">{s.name}</div><div className="text-[12px] text-ink-500">{s.rhsNumber} · {s.position}</div></td>
            <td className="table-td text-[12.5px] text-ink-700">{t ? t.lines.map((l) => `${l.projectCode} ${l.days}d`).join(' · ') + (t.leaveDays ? ` · leave ${t.leaveDays}d` : '') : <span className="text-ink-400">—</span>}</td>
            <td className="table-td text-right">{t ? `${timesheetTotal(t) + t.leaveDays} / ${t.workingDays}` : ''}</td>
            <td className="table-td">{t ? <span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', TS_STATUS_TONE[t.status])}>{TS_STATUS_LABEL[t.status]}</span> : <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-500">not created</span>}{t?.returnNote && <div className="text-[11px] text-accent-700">{t.returnNote}</div>}</td>
            <td className="table-td text-[12px] text-ink-600">{t ? `${t.createdByName} · ${fmtDateTime(t.updatedAt)}` : ''}</td>
            <td className="table-td"><div className="flex justify-end gap-1">
              {canActOn(s) && (!t || ['draft', 'returned'].includes(t.status)) && <button className="btn-primary btn-sm" data-testid={`ts-${s.rhsNumber}`} onClick={() => open(s, t)}>{t ? 'Edit' : <><Plus size={13} /> Create</>}</button>}
              {t && !['draft', 'returned'].includes(t.status) && <button className="btn-ghost btn-sm" onClick={() => open(s, t)}>View</button>}
              {t && t.status === 'acknowledged' && hrManage && <><button className="btn-primary btn-sm" data-testid="ts-approve" onClick={() => setTimesheetStatus(t.id, 'approved')}><Check size={13} /> Approve</button><button className="btn-ghost btn-sm text-accent-700" onClick={() => { setNote(''); setRet(t) }}><Undo2 size={13} /> Return</button></>}
              {t && <button className="btn-ghost btn-sm" onClick={() => exportTimesheet(t, s, settings, projects)} title="Download (Excel)"><Download size={13} /></button>}
            </div></td></tr>))}</tbody></table></div></Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} width="max-w-3xl" title={edit ? `Timesheet · ${edit.st.name} · ${monthLabel(period)}` : ''}
        footer={edit && (['draft', 'returned'].includes(edit.t.status) && canActOn(edit.st) ? <><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-secondary" onClick={() => save(false)}>Save draft</button><button className="btn-primary" data-testid="ts-submit" onClick={() => save(true)}><Send size={14} /> Submit to staff</button></> : <button className="btn-secondary" onClick={() => setEdit(null)}>Close</button>)}>
        {edit && (() => { const ro = !['draft', 'returned'].includes(edit.t.status) || !canActOn(edit.st); return (
          <div className="space-y-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-3 text-ink-600"><span>Working days <b className="text-ink-900">{edit.t.workingDays}</b></span><span>· Approved leave <b className="text-ink-900">{edit.t.leaveDays}</b></span><span>· To allocate <b className="text-ink-900">{edit.t.workingDays - edit.t.leaveDays}</b></span>{!ro && <button className="btn-secondary btn-sm ml-auto" onClick={() => setEdit({ ...edit, t: { ...edit.t, lines: suggestTimesheet(edit.st, budgets, projects, period, edit.t.workingDays - edit.t.leaveDays) } })}><Wand2 size={13} /> Prefill from salary plan</button>}</div>
            <table className="w-full"><thead><tr><th className="table-th w-48">Project</th><th className="table-th">Description / budget line</th><th className="table-th w-24 text-right">Days</th><th className="table-th w-8" /></tr></thead>
              <tbody>{edit.t.lines.map((l) => <tr key={l.id}><td className="table-td py-1.5"><select className="input text-[12.5px]" disabled={ro} value={l.projectId ?? (l.projectCode === 'CORE' ? 'CORE' : '')} onChange={(e) => { const v = e.target.value; const p = projectOpts.find((x) => x.id === v); setLine(l.id, v === 'CORE' ? { projectId: undefined, projectCode: 'CORE' } : { projectId: p?.id, projectCode: p?.code ?? '' }) }}><option value="">— project —</option><option value="CORE">CORE · unrestricted</option>{projectOpts.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title.slice(0, 32)}</option>)}</select></td><td className="table-td py-1.5"><input className="input text-[12.5px]" disabled={ro} value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} /></td><td className="table-td py-1.5"><input type="number" step="0.5" min="0" className="input text-right" disabled={ro} value={l.days} onChange={(e) => setLine(l.id, { days: Number(e.target.value) })} /></td><td className="table-td py-1.5">{!ro && <button className="btn-ghost btn-sm text-accent-700" onClick={() => setEdit({ ...edit, t: { ...edit.t, lines: edit.t.lines.filter((x) => x.id !== l.id) } })}><Trash2 size={13} /></button>}</td></tr>)}
                <tr><td className="table-td" colSpan={2}>Leave / public holidays</td><td className="table-td py-1.5"><input type="number" step="0.5" className="input text-right" disabled={ro} value={edit.t.leaveDays} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, leaveDays: Number(e.target.value) } })} /></td><td /></tr>
                <tr className={cx('font-semibold', Math.abs(total - edit.t.workingDays) > 0.01 ? 'bg-sun-50 text-sun-700' : 'bg-brand-50 text-brand-800')}><td className="table-td" colSpan={2}>Total</td><td className="table-td text-right">{total} / {edit.t.workingDays}</td><td /></tr></tbody></table>
            {!ro && <button className="btn-secondary btn-sm" onClick={() => setEdit({ ...edit, t: { ...edit.t, lines: [...edit.t.lines, { id: uid('tl_'), projectCode: '', description: '', days: 0 }] } })}><Plus size={13} /> Add line</button>}
            <Field label="Note"><input className="input" disabled={ro} value={edit.t.note ?? ''} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, note: e.target.value } })} /></Field>
            {edit.t.acknowledgedAt && <Alert tone="info">Acknowledged by the staff member {fmtDateTime(edit.t.acknowledgedAt)}{edit.t.approvedAt && ` · approved by ${edit.t.approvedByName} ${fmtDateTime(edit.t.approvedAt)}`}</Alert>}
          </div>) })()}
      </Modal>
      <Modal open={!!ret} onClose={() => setRet(null)} title="Return timesheet to the line manager" footer={<><button className="btn-secondary" onClick={() => setRet(null)}>Cancel</button><button className="btn-danger" onClick={() => { if (ret) setTimesheetStatus(ret.id, 'returned', note); setRet(null) }}>Return</button></>}>
        <Field label="What needs to change" required><textarea className="input min-h-[72px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </>
  )
}
