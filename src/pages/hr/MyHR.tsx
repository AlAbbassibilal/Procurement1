import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, LogIn, LogOut, CalendarDays, Download, FileCheck2, Send, XCircle, Users, Briefcase, Home } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Stat, Field, Alert, Modal, KV } from '@/components/ui'
import { balances, hrSettings, workingDaysBetween, LEAVE_LABEL, LEAVE_TONE, LEAVE_STATUS_TONE, TS_STATUS_LABEL, TS_STATUS_TONE, MODE_LABEL, mapLink, hoursWorked, capturePosition, today, contractDaysLeft, downloadPayslip, timesheetTotal, onLeaveToday } from '@/lib/hr'
import { monthLabel } from '@/lib/grants'
import { fmtDate, fmtDateTime, fmtMoney, cx } from '@/lib/format'
import { useHrContext } from './shared'
import type { LeaveType, Timesheet, AttendanceMode } from '@/types'

export default function MyHR() {
  const { me, reports, isManager } = useHrContext()
  const { staff, leaveRequests, timesheets, payslips, attendance, settings, projects, submitLeave, cancelLeave, setTimesheetStatus, checkIn, checkOut } = useStore()
  const hr = hrSettings(settings)
  const [mode, setMode] = useState<AttendanceMode>('office')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null)
  const [req, setReq] = useState({ type: 'annual' as LeaveType, startDate: '', endDate: '', reason: '' })
  const [tsOpen, setTsOpen] = useState<Timesheet | null>(null)
  if (!me) return <><PageHeader title="My HR" /><Alert tone="warning">No HR record is linked to your account yet. Ask HR & Admin to link your RHS number on the <Link to="/hr/staff" className="underline">staff register</Link>.</Alert></>

  const bal = balances(me, leaveRequests, settings)
  const mine = leaveRequests.filter((r) => r.staffId === me.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const myTs = timesheets.filter((t) => t.staffId === me.id).sort((a, b) => b.period.localeCompare(a.period))
  const mySlips = payslips.filter((p) => p.staffId === me.id).sort((a, b) => b.period.localeCompare(a.period))
  const todayRec = attendance.find((a) => a.staffId === me.id && a.date === today())
  const wfhToday = mine.some((r) => r.type === 'wfh' && onLeaveToday(r))
  const manager = staff.find((s) => s.id === me.lineManagerId)
  const daysLeft = contractDaysLeft(me)
  const reqDays = req.startDate && req.endDate ? workingDaysBetween(req.startDate, req.endDate, hr.weekend) : 0
  const pendingForMe = leaveRequests.filter((r) => r.status === 'pending' && reports.some((s) => s.id === r.staffId)).length

  const doCheckIn = async () => {
    setBusy(true); setMsg(null)
    const pos = await capturePosition()
    const r = checkIn({ mode: wfhToday && mode === 'office' ? 'wfh' : mode, ...pos, locationStatus: pos.status })
    setBusy(false)
    if (!r.ok) return setMsg({ tone: 'danger', text: r.error ?? 'Could not check in.' })
    setMsg(pos.status === 'captured' ? { tone: 'success', text: `Checked in at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — location captured (±${pos.accuracy} m).` } : { tone: 'warning', text: `Checked in — location ${pos.status === 'denied' ? 'permission was denied' : 'not available'}; the time was recorded.` })
  }
  const doCheckOut = async () => { setBusy(true); const pos = await capturePosition(); checkOut(pos); setBusy(false); setMsg({ tone: 'success', text: 'Checked out — have a good evening.' }) }
  const submit = () => { const r = submitLeave(req); if (!r.ok) return setMsg({ tone: 'danger', text: r.error ?? '' }); setMsg({ tone: 'success', text: `${r.request!.number} submitted to ${manager?.name ?? 'HR'} for approval.` }); setReq({ type: 'annual', startDate: '', endDate: '', reason: '' }) }

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{me.rhsNumber}</span>} title="My HR" subtitle={`${me.position} · ${me.department} · ${me.country}${manager ? ` · Line manager ${manager.name}` : ''}`}
        actions={isManager && <Link to="/hr/requests" className="btn-secondary"><Users size={15} /> My team{pendingForMe > 0 && <span className="rounded-pill bg-sun-500 px-1.5 text-[11px] font-bold text-ink-900">{pendingForMe}</span>}</Link>} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Check-in */}
          <Card title={<span className="flex items-center gap-2"><MapPin size={16} /> Attendance today · {fmtDate(today())}</span>} description="Check in when you start working; the time and your location are recorded. Check out when you finish.">
            {!todayRec ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Where are you working today?"><select className="input w-56" value={wfhToday ? 'wfh' : mode} onChange={(e) => setMode(e.target.value as AttendanceMode)} disabled={wfhToday}><option value="office">Office</option><option value="wfh">Work from home{wfhToday ? ' (approved today)' : ''}</option><option value="field">Field / mission</option></select></Field>
                <button className="btn-primary btn-lg" data-testid="check-in" disabled={busy} onClick={doCheckIn}><LogIn size={16} /> {busy ? 'Capturing location…' : 'Check in'}</button>
                <span className="pb-2 text-[12px] text-ink-500">Expected between {hr.checkInStart} and {hr.checkInEnd}. Your browser will ask to share your location.</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <Stat label="Checked in" value={new Date(todayRec.checkInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} hint={MODE_LABEL[todayRec.mode]} tone="brand" />
                <Stat label="Location" value={todayRec.locationStatus === 'captured' ? <a className="text-[15px] text-brand-700 hover:underline" href={mapLink(todayRec.lat!, todayRec.lng!)} target="_blank" rel="noreferrer">{todayRec.lat}, {todayRec.lng}</a> : <span className="text-[15px] text-ink-500">{todayRec.locationStatus === 'denied' ? 'Permission denied' : 'Not available'}</span>} hint={todayRec.accuracy ? `±${todayRec.accuracy} m` : undefined} />
                {todayRec.checkOutAt ? <Stat label="Checked out" value={new Date(todayRec.checkOutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} hint={`${hoursWorked(todayRec)} h worked`} /> : <button className="btn-secondary btn-lg" data-testid="check-out" disabled={busy} onClick={doCheckOut}><LogOut size={16} /> Check out</button>}
              </div>
            )}
          </Card>

          {/* Requests */}
          <Card title={<span className="flex items-center gap-2"><CalendarDays size={16} /> Leave & work-from-home requests</span>} description={`Approved by ${manager?.name ?? 'HR & Admin'} · weekend ${hr.weekend.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(' / ')} is not counted`}>
            <div className="grid gap-3 rounded-control border border-line bg-surface-muted p-3 sm:grid-cols-[1fr_1fr_1fr_2fr_auto] sm:items-end">
              <Field label="Type"><select className="input" value={req.type} onChange={(e) => setReq({ ...req, type: e.target.value as LeaveType })}>{(Object.keys(LEAVE_LABEL) as LeaveType[]).map((t) => <option key={t} value={t}>{LEAVE_LABEL[t]}</option>)}</select></Field>
              <Field label="From"><input type="date" className="input" value={req.startDate} onChange={(e) => setReq({ ...req, startDate: e.target.value, endDate: req.endDate || e.target.value })} /></Field>
              <Field label="To"><input type="date" className="input" value={req.endDate} min={req.startDate} onChange={(e) => setReq({ ...req, endDate: e.target.value })} /></Field>
              <Field label={`Reason${reqDays ? ` · ${reqDays} working day(s)` : ''}`}><input className="input" value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} placeholder={req.type === 'wfh' ? 'What you will work on' : 'Optional'} /></Field>
              <button className="btn-primary" data-testid="submit-request" disabled={!reqDays} onClick={submit}><Send size={14} /> Submit</button>
            </div>
            <table className="mt-4 w-full text-[13px]"><thead><tr><th className="table-th">Request</th><th className="table-th">Type</th><th className="table-th">Dates</th><th className="table-th text-right">Days</th><th className="table-th">Status</th><th className="table-th w-10" /></tr></thead>
              <tbody>{mine.length === 0 && <tr><td colSpan={6} className="table-td text-ink-500">No requests yet.</td></tr>}{mine.map((r) => <tr key={r.id}><td className="table-td"><span className="font-mono text-[12px]">{r.number}</span><div className="text-[12px] text-ink-500">{r.reason}</div></td><td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', LEAVE_TONE[r.type])}>{LEAVE_LABEL[r.type]}</span></td><td className="table-td">{fmtDate(r.startDate)}{r.endDate !== r.startDate && ` – ${fmtDate(r.endDate)}`}</td><td className="table-td text-right">{r.days}</td><td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold capitalize', LEAVE_STATUS_TONE[r.status])}>{r.status}</span>{r.decidedByName && <div className="text-[11px] text-ink-500">{r.decidedByName} · {fmtDate(r.decidedAt)}{r.decisionNote && ` · ${r.decisionNote}`}</div>}</td><td className="table-td">{r.status === 'pending' && <button className="btn-ghost btn-sm text-accent-700" title="Cancel" onClick={() => cancelLeave(r.id)}><XCircle size={13} /></button>}</td></tr>)}</tbody></table>
          </Card>

          {/* Timesheets */}
          <Card title={<span className="flex items-center gap-2"><FileCheck2 size={16} /> My timesheets</span>} description="Prepared monthly by your line manager from the projects that fund your position — review and acknowledge.">
            <table className="w-full text-[13px]"><thead><tr><th className="table-th">Month</th><th className="table-th">Projects</th><th className="table-th text-right">Days</th><th className="table-th">Status</th><th className="table-th w-32" /></tr></thead>
              <tbody>{myTs.length === 0 && <tr><td colSpan={5} className="table-td text-ink-500">No timesheet yet.</td></tr>}{myTs.map((t) => <tr key={t.id}><td className="table-td font-medium">{monthLabel(t.period)}</td><td className="table-td text-[12.5px] text-ink-700">{t.lines.map((l) => `${l.projectCode} ${l.days}d`).join(' · ') || '—'}</td><td className="table-td text-right">{timesheetTotal(t) + t.leaveDays} / {t.workingDays}</td><td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', TS_STATUS_TONE[t.status])}>{TS_STATUS_LABEL[t.status]}</span></td><td className="table-td"><div className="flex justify-end gap-1"><button className="btn-ghost btn-sm" onClick={() => setTsOpen(t)}>View</button>{t.status === 'submitted' && <button className="btn-primary btn-sm" data-testid="acknowledge" onClick={() => { if (confirm('Acknowledge this timesheet as a true record of your time?')) setTimesheetStatus(t.id, 'acknowledged') }}>Acknowledge</button>}</div></td></tr>)}</tbody></table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><Briefcase size={16} /> My contract</span>}>
            <KV k="RHS number" v={<span className="font-mono">{me.rhsNumber}</span>} /><KV k="Position" v={me.position} /><KV k="Contract type" v={me.contractType.replace('_', '-')} /><KV k="Contract start" v={fmtDate(me.startDate)} /><KV k="Contract end" v={me.endDate ? <span className={cx(daysLeft !== null && daysLeft <= 60 && 'font-semibold text-accent-700')}>{fmtDate(me.endDate)}{daysLeft !== null && ` · ${daysLeft} days left`}</span> : 'Open-ended'} />{me.contractRef && <KV k="Contract ref." v={me.contractRef} />}<KV k="Line manager" v={manager?.name ?? '—'} /><KV k="Monthly salary" v={fmtMoney(me.monthlySalary, me.currency)} />
          </Card>
          <Card title="Balances this year">
            <div className="space-y-4">
              {([['Annual leave', bal.annual, 'bg-brand-600'], ['Work from home', bal.wfh, 'bg-info-500']] as const).map(([l, b, c]) => <div key={l}><div className="mb-1 flex items-center justify-between text-[13px]"><span className="flex items-center gap-1.5 font-medium text-ink-900">{l === 'Work from home' && <Home size={13} />}{l}</span><span className="text-[12px] text-ink-500">{b.used} used · {b.pending} pending</span></div><div className="h-2.5 overflow-hidden rounded-pill bg-ink-100"><div className={cx('h-full', c)} style={{ width: `${b.entitlement ? (b.used / b.entitlement) * 100 : 0}%` }} /></div><div className="mt-1 text-[12.5px]"><b className="text-[16px] text-ink-900" data-testid={l === 'Annual leave' ? 'annual-remaining' : 'wfh-remaining'}>{b.remaining}</b> <span className="text-ink-500">of {b.entitlement} days remaining</span></div></div>)}
              <div className="text-[12.5px] text-ink-600">Sick leave taken: <b>{bal.sick}</b> day(s)</div>
            </div>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Download size={16} /> Payslips</span>} description="Available once Finance has paid the month">
            <ul className="divide-y divide-line">{mySlips.length === 0 && <li className="py-2 text-[13px] text-ink-500">No payslip yet.</li>}{mySlips.map((p) => <li key={p.id} className="flex items-center justify-between py-2 text-[13px]"><span><b className="text-ink-900">{monthLabel(p.period)}</b><span className="block text-[12px] text-ink-500">Net {fmtMoney(p.net, p.currency)} · paid {fmtDate(p.paidAt)}</span></span><button className="btn-secondary btn-sm" data-testid="download-payslip" onClick={() => downloadPayslip(p, me, settings)}><Download size={13} /> PDF</button></li>)}</ul>
          </Card>
        </div>
      </div>

      <Modal open={!!tsOpen} onClose={() => setTsOpen(null)} width="max-w-2xl" title={tsOpen ? `Timesheet · ${monthLabel(tsOpen.period)}` : ''} footer={<>{tsOpen?.status === 'submitted' && <button className="btn-primary" onClick={() => { setTimesheetStatus(tsOpen.id, 'acknowledged'); setTsOpen(null) }}>Acknowledge</button>}<button className="btn-secondary" onClick={() => setTsOpen(null)}>Close</button></>}>
        {tsOpen && <div className="text-[13px]"><div className="mb-3 text-ink-600">Prepared by {tsOpen.createdByName} · {fmtDateTime(tsOpen.updatedAt)} · working days {tsOpen.workingDays}{tsOpen.returnNote && <div className="mt-1 text-accent-700">Returned: {tsOpen.returnNote}</div>}</div>
          <table className="w-full"><thead><tr><th className="table-th">Project</th><th className="table-th">Description</th><th className="table-th text-right">Days</th><th className="table-th text-right">%</th></tr></thead><tbody>{tsOpen.lines.map((l) => <tr key={l.id}><td className="table-td">{l.projectId ? <Link to={`/grants/${l.projectId}`} className="text-brand-700 hover:underline">{l.projectCode}</Link> : l.projectCode}<div className="text-[11.5px] text-ink-500">{projects.find((p) => p.id === l.projectId)?.title}</div></td><td className="table-td">{l.description}</td><td className="table-td text-right">{l.days}</td><td className="table-td text-right">{tsOpen.workingDays ? Math.round((l.days / tsOpen.workingDays) * 100) : 0}%</td></tr>)}<tr><td className="table-td" colSpan={2}>Leave</td><td className="table-td text-right">{tsOpen.leaveDays}</td><td className="table-td" /></tr><tr className="bg-surface-muted font-semibold"><td className="table-td" colSpan={2}>Total</td><td className="table-td text-right">{timesheetTotal(tsOpen) + tsOpen.leaveDays} / {tsOpen.workingDays}</td><td className="table-td" /></tr></tbody></table></div>}
      </Modal>
    </>
  )
}
