import { useState } from 'react'
import { Play, Download } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat, Alert } from '@/components/ui'
import { accessOf } from '@/lib/departments'
import { downloadPayslip, hrSettings } from '@/lib/hr'
import { monthLabel } from '@/lib/grants'
import { fmtMoney, fmtDate } from '@/lib/format'
import { useHrContext } from './shared'

export default function HrPayroll() {
  const user = useCurrentUser()!
  const { hrManage, visibleStaff } = useHrContext()
  const { staff, payslips, settings, runPayroll } = useStore()
  const canRun = user.role === 'admin' || accessOf(user, 'finance') === 'manage'
  const ym = (o: number) => { const x = new Date(); x.setMonth(x.getMonth() + o); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
  const [period, setPeriod] = useState(ym(0))
  const [msg, setMsg] = useState('')
  const hr = hrSettings(settings)
  const visible = new Set(visibleStaff.map((s) => s.id))
  const slips = payslips.filter((p) => p.period === period && visible.has(p.staffId)).sort((a, b) => a.number.localeCompare(b.number))
  const due = staff.filter((s) => s.status === 'active' && s.monthlySalary > 0 && !payslips.some((p) => p.staffId === s.id && p.period === period)).length
  const ccy = settings.defaultCurrency
  return (
    <>
      <PageHeader title="Payroll & payslips" subtitle={`Finance runs the month: one payslip per active staff member from the master salary plan (social security ${hr.socialSecurityPct}%, income tax ${hr.incomeTaxPct}%, unpaid leave deducted). Staff download their own from My HR.`}
        actions={<div className="flex gap-2"><select className="input w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>{[ym(-2), ym(-1), ym(0), ym(1)].map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}</select>{canRun && <button className="btn-primary" data-testid="run-payroll" disabled={!due} onClick={() => { if (confirm(`Run payroll for ${monthLabel(period)} — ${due} payslip(s) will be generated and staff notified?`)) { const r = runPayroll(period); setMsg(`${r.created} payslip(s) generated for ${monthLabel(period)}.`) } }}><Play size={15} /> Run payroll{due ? ` (${due})` : ''}</button>}</div>} />
      {msg && <div className="mb-4"><Alert tone="success">{msg}</Alert></div>}
      <div className="mb-5 grid gap-4 sm:grid-cols-4"><Stat label={`Payslips · ${monthLabel(period)}`} value={slips.length} tone="brand" /><Stat label="Gross" value={fmtMoney(slips.reduce((s, p) => s + p.gross, 0), ccy)} /><Stat label="Deductions" value={fmtMoney(slips.reduce((s, p) => s + p.socialSecurity + p.tax + p.unpaidDeduction + p.otherDeductions, 0), ccy)} /><Stat label="Net paid" value={fmtMoney(slips.reduce((s, p) => s + p.net, 0), ccy)} tone="brand" hint={due ? `${due} staff not yet paid this month` : 'all active staff paid'} /></div>
      <Card padded={false}><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-[13px]">
        <thead><tr><th className="table-th">Payslip</th><th className="table-th">Staff</th><th className="table-th text-right">Gross</th><th className="table-th text-right">Social security</th><th className="table-th text-right">Unpaid leave</th><th className="table-th text-right">Net</th><th className="table-th">Paid</th><th className="table-th w-24" /></tr></thead>
        <tbody>{slips.length === 0 && <tr><td colSpan={8} className="table-td text-ink-500">No payslips for {monthLabel(period)}{canRun && due ? ' — run the payroll.' : '.'}</td></tr>}{slips.map((p) => { const st = staff.find((s) => s.id === p.staffId)!; return <tr key={p.id} className="hover:bg-surface-muted"><td className="table-td font-mono text-[12px]">{p.number}</td><td className="table-td"><div className="font-medium text-ink-900">{st.name}</div><div className="text-[12px] text-ink-500">{st.rhsNumber} · {st.position}</div></td><td className="table-td text-right tabular-nums">{fmtMoney(p.gross, p.currency)}</td><td className="table-td text-right tabular-nums">{fmtMoney(p.socialSecurity, p.currency)}</td><td className="table-td text-right tabular-nums">{p.unpaidDays ? `${fmtMoney(p.unpaidDeduction, p.currency)} (${p.unpaidDays}d)` : '—'}</td><td className="table-td text-right font-semibold tabular-nums">{fmtMoney(p.net, p.currency)}</td><td className="table-td text-[12px] text-ink-600">{fmtDate(p.paidAt)} · {p.generatedByName}</td><td className="table-td">{(hrManage || canRun || st.userId === user.id) && <button className="btn-secondary btn-sm" onClick={() => downloadPayslip(p, st, settings)}><Download size={13} /> PDF</button>}</td></tr> })}</tbody></table></div></Card>
    </>
  )
}
