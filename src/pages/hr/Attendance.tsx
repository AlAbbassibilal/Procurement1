import { useState } from 'react'
import { MapPin, Download } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, PageHeader, Stat } from '@/components/ui'
import { mapLink, hoursWorked, MODE_LABEL, today, onLeaveToday, hrSettings } from '@/lib/hr'
import { fmtDate, cx } from '@/lib/format'
import { useHrContext } from './shared'

export default function HrAttendance() {
  const { visibleStaff } = useHrContext()
  const { attendance, leaveRequests, settings } = useStore()
  const hr = hrSettings(settings)
  const [day, setDay] = useState(today())
  const rows = visibleStaff.filter((s) => s.status === 'active').map((s) => ({ s, a: attendance.find((x) => x.staffId === s.id && x.date === day), leave: leaveRequests.find((r) => r.staffId === s.id && onLeaveToday(r, day)) }))
  const late = (t: string) => new Date(t).toTimeString().slice(0, 5) > hr.checkInEnd
  const exportX = async () => { const X = await import('xlsx'); const aoa = [['Date', 'RHS no.', 'Name', 'Mode', 'Check-in', 'Check-out', 'Hours', 'Latitude', 'Longitude', 'Accuracy (m)', 'Location', 'Leave'], ...rows.map(({ s, a, leave }) => [day, s.rhsNumber, s.name, a ? MODE_LABEL[a.mode] : '', a ? a.checkInAt.slice(11, 16) : '', a?.checkOutAt ? a.checkOutAt.slice(11, 16) : '', a ? hoursWorked(a) ?? '' : '', a?.lat ?? '', a?.lng ?? '', a?.accuracy ?? '', a?.locationStatus ?? '', leave?.number ?? ''])]; const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'Attendance'); X.writeFile(wb, `Attendance_${day}.xlsx`) }
  return (
    <>
      <PageHeader title="Attendance" subtitle="Daily check-ins with the captured location. Staff check in from My HR; the browser location is stored with the time." actions={<div className="flex gap-2"><input type="date" className="input w-44" value={day} onChange={(e) => setDay(e.target.value)} /><button className="btn-secondary" onClick={exportX}><Download size={15} /> Export</button></div>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-4"><Stat label="Checked in" value={rows.filter((r) => r.a).length} tone="brand" /><Stat label="On approved leave / WFH" value={rows.filter((r) => r.leave).length} /><Stat label="No check-in" value={rows.filter((r) => !r.a && !r.leave).length} tone={rows.some((r) => !r.a && !r.leave) ? 'sun' : 'default'} /><Stat label={`Late (after ${hr.checkInEnd})`} value={rows.filter((r) => r.a && late(r.a.checkInAt)).length} tone={rows.some((r) => r.a && late(r.a.checkInAt)) ? 'accent' : 'default'} /></div>
      <Card padded={false} title={fmtDate(day)}><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-[13px]">
        <thead><tr><th className="table-th">Staff</th><th className="table-th">Mode</th><th className="table-th">Check-in</th><th className="table-th">Check-out</th><th className="table-th text-right">Hours</th><th className="table-th">Location</th><th className="table-th">Note</th></tr></thead>
        <tbody>{rows.map(({ s, a, leave }) => <tr key={s.id} className="hover:bg-surface-muted"><td className="table-td"><div className="font-medium text-ink-900">{s.name}</div><div className="text-[12px] text-ink-500">{s.rhsNumber} · {s.position}</div></td>
          <td className="table-td">{a ? MODE_LABEL[a.mode] : leave ? <span className="rounded-pill bg-info-50 px-2 py-0.5 text-[11px] font-semibold text-info-700">{leave.type === 'wfh' ? 'WFH approved' : 'On leave'} · {leave.number}</span> : <span className="text-ink-400">—</span>}</td>
          <td className="table-td">{a ? <span className={cx(late(a.checkInAt) && 'font-semibold text-accent-700')}>{new Date(a.checkInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> : <span className="text-ink-400">not checked in</span>}</td>
          <td className="table-td">{a?.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : a ? <span className="text-brand-700">working</span> : ''}</td>
          <td className="table-td text-right">{a ? hoursWorked(a) ?? '' : ''}</td>
          <td className="table-td">{a?.locationStatus === 'captured' ? <a href={mapLink(a.lat!, a.lng!)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline"><MapPin size={13} /> {a.lat}, {a.lng} <span className="text-ink-400">±{a.accuracy} m</span></a> : a ? <span className="text-ink-500">{a.locationStatus === 'denied' ? 'permission denied' : 'unavailable'}</span> : ''}</td>
          <td className="table-td text-[12px] text-ink-600">{a?.note ?? ''}</td></tr>)}</tbody></table></div></Card>
    </>
  )
}
