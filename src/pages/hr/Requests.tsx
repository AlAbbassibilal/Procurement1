import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Stat } from '@/components/ui'
import { balances, LEAVE_LABEL, LEAVE_TONE, LEAVE_STATUS_TONE } from '@/lib/hr'
import { fmtDate, fmtDateTime, cx } from '@/lib/format'
import { useHrContext } from './shared'
import type { LeaveRequest } from '@/types'

export default function HrRequests() {
  const { me, hrManage, canActOn, visibleStaff } = useHrContext()
  const { staff, leaveRequests, settings, decideLeave } = useStore()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [decide, setDecide] = useState<{ r: LeaveRequest; approve: boolean } | null>(null)
  const [note, setNote] = useState('')
  const visibleIds = new Set(visibleStaff.map((s) => s.id))
  const list = leaveRequests.filter((r) => visibleIds.has(r.staffId)).filter((r) => filter === 'all' || r.status === 'pending').sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const forMe = leaveRequests.filter((r) => r.status === 'pending' && canActOn(staff.find((s) => s.id === r.staffId)!) && r.staffId !== me?.id)
  return (
    <>
      <PageHeader title="Leave & work-from-home requests" subtitle={hrManage ? 'All requests across the organisation — line managers decide for their reports, HR can decide for anyone.' : 'Requests from the staff you line-manage.'} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Stat label="Awaiting your decision" value={forMe.length} tone={forMe.length ? 'sun' : 'default'} /><Stat label="Pending overall" value={list.filter((r) => r.status === 'pending').length} /><Stat label="On leave / WFH today" value={leaveRequests.filter((r) => r.status === 'approved' && r.startDate <= new Date().toISOString().slice(0, 10) && r.endDate >= new Date().toISOString().slice(0, 10)).length} /></div>
      <div className="mb-3 flex gap-1">{(['pending', 'all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cx('rounded-pill px-3 py-1 text-[12.5px] font-medium', filter === f ? 'bg-ink-900 text-white' : 'bg-surface text-ink-600 ring-1 ring-inset ring-line')}>{f === 'pending' ? 'Pending' : 'All'}</button>)}</div>
      <Card padded={false}><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]">
        <thead><tr><th className="table-th">Request</th><th className="table-th">Staff</th><th className="table-th">Type</th><th className="table-th">Dates</th><th className="table-th text-right">Days</th><th className="table-th">Balance after</th><th className="table-th">Status</th><th className="table-th w-44" /></tr></thead>
        <tbody>{list.length === 0 && <tr><td colSpan={8} className="table-td text-ink-500">Nothing here.</td></tr>}{list.map((r) => { const st = staff.find((s) => s.id === r.staffId)!; const b = balances(st, leaveRequests, settings, Number(r.startDate.slice(0, 4))); const after = r.type === 'annual' ? b.annual.remaining - (r.status === 'pending' ? r.days : 0) : r.type === 'wfh' ? b.wfh.remaining - (r.status === 'pending' ? r.days : 0) : null; return (
          <tr key={r.id} className="hover:bg-surface-muted"><td className="table-td"><span className="font-mono text-[12px]">{r.number}</span><div className="text-[12px] text-ink-500">{r.reason}</div><div className="text-[11px] text-ink-400">submitted {fmtDateTime(r.submittedAt)}</div></td><td className="table-td"><div className="font-medium text-ink-900">{st.name}</div><div className="text-[12px] text-ink-500">{st.position}</div></td><td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold', LEAVE_TONE[r.type])}>{LEAVE_LABEL[r.type]}</span></td><td className="table-td">{fmtDate(r.startDate)}{r.endDate !== r.startDate && ` – ${fmtDate(r.endDate)}`}</td><td className="table-td text-right">{r.days}</td><td className="table-td">{after === null ? '—' : <span className={cx(after < 0 && 'font-semibold text-accent-700')}>{after} of {r.type === 'annual' ? b.annual.entitlement : b.wfh.entitlement}</span>}</td><td className="table-td"><span className={cx('rounded-pill px-2 py-0.5 text-[11px] font-semibold capitalize', LEAVE_STATUS_TONE[r.status])}>{r.status}</span>{r.decidedByName && <div className="text-[11px] text-ink-500">{r.decidedByName} · {fmtDate(r.decidedAt)}</div>}</td>
            <td className="table-td">{r.status === 'pending' && canActOn(st) && r.staffId !== me?.id && <div className="flex justify-end gap-1"><button className="btn-primary btn-sm" data-testid="decide-yes" onClick={() => { setNote(''); setDecide({ r, approve: true }) }}><Check size={13} /> Approve</button><button className="btn-danger-soft btn-sm" onClick={() => { setNote(''); setDecide({ r, approve: false }) }}><X size={13} /> Reject</button></div>}</td></tr>) })}</tbody></table></div></Card>
      <Modal open={!!decide} onClose={() => setDecide(null)} title={decide ? `${decide.approve ? 'Approve' : 'Reject'} ${decide.r.number}` : ''} footer={<><button className="btn-secondary" onClick={() => setDecide(null)}>Cancel</button><button className={decide?.approve ? 'btn-primary' : 'btn-danger'} onClick={() => { if (decide) decideLeave(decide.r.id, decide.approve, note || undefined); setDecide(null) }}>Confirm</button></>}>
        {decide && <div className="space-y-3 text-[13px]"><p className="text-ink-700"><b>{decide.r.staffName}</b> · {LEAVE_LABEL[decide.r.type]} · {decide.r.days} day(s) · {fmtDate(decide.r.startDate)} – {fmtDate(decide.r.endDate)}</p><Field label="Note to the staff member (optional)"><textarea className="input min-h-[64px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>}
      </Modal>
    </>
  )
}
