// ---------------------------------------------------------------------------
// HR & Admin engine — working days, leave / WFH balances, timesheets,
// payroll & payslips (PDF), attendance helpers.
// ---------------------------------------------------------------------------
import * as XLSX from 'xlsx'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { AttendanceRecord, HrSettings, LeaveRequest, LeaveType, OrgSettings, Payslip, Project, ProjectBudget, StaffMember, Timesheet, TimesheetLine } from '@/types'
import { monthsOf, monthLabel } from './grants'
import { uid } from './format'

export const HR_DEFAULTS: HrSettings = { annualLeaveDays: 14, wfhDays: 14, weekend: [5, 6], socialSecurityPct: 7.5, incomeTaxPct: 0, checkInStart: '08:00', checkInEnd: '10:00' }
export const hrSettings = (s: OrgSettings): HrSettings => ({ ...HR_DEFAULTS, ...(s.hr ?? {}) })

export const LEAVE_LABEL: Record<LeaveType, string> = { annual: 'Annual leave', sick: 'Sick leave', unpaid: 'Unpaid leave', compassionate: 'Compassionate leave', maternity: 'Maternity / paternity leave', wfh: 'Work from home' }
export const LEAVE_TONE: Record<LeaveType, string> = { annual: 'bg-brand-100 text-brand-800', sick: 'bg-accent-100 text-accent-700', unpaid: 'bg-ink-100 text-ink-700', compassionate: 'bg-ink-100 text-ink-700', maternity: 'bg-sun-100 text-sun-700', wfh: 'bg-info-50 text-info-700' }
export const LEAVE_STATUS_TONE = { pending: 'bg-sun-100 text-sun-700', approved: 'bg-brand-100 text-brand-800', rejected: 'bg-danger-50 text-danger-700', cancelled: 'bg-ink-100 text-ink-500' } as const
export const TS_STATUS_LABEL = { draft: 'Draft', submitted: 'Submitted — awaiting staff', acknowledged: 'Acknowledged — awaiting approval', approved: 'Approved', returned: 'Returned' } as const
export const TS_STATUS_TONE = { draft: 'bg-ink-100 text-ink-700', submitted: 'bg-sun-100 text-sun-700', acknowledged: 'bg-info-50 text-info-700', approved: 'bg-brand-100 text-brand-800', returned: 'bg-danger-50 text-danger-700' } as const
export const MODE_LABEL = { office: 'Office', wfh: 'Work from home', field: 'Field' } as const

// ---- calendar --------------------------------------------------------------
const d = (iso: string) => new Date(iso + 'T00:00:00')
export const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
export const today = () => iso(new Date())
/** Working days between two dates inclusive, skipping the configured weekend (Fri–Sat by default). */
export const workingDaysBetween = (start: string, end: string, weekend: number[]) => {
  if (!start || !end || end < start) return 0
  let n = 0; const x = d(start); const e = d(end)
  while (x <= e) { if (!weekend.includes(x.getDay())) n++; x.setDate(x.getDate() + 1) }
  return n
}
export const monthRange = (period: string) => { const [y, m] = period.split('-').map(Number); return { start: `${period}-01`, end: iso(new Date(y!, m!, 0)) } }
export const workingDaysInMonth = (period: string, weekend: number[]) => { const r = monthRange(period); return workingDaysBetween(r.start, r.end, weekend) }
/** Working days of an approved request that fall inside a month. */
export const requestDaysInMonth = (r: LeaveRequest, period: string, weekend: number[]) => {
  const m = monthRange(period); const s = r.startDate > m.start ? r.startDate : m.start; const e = r.endDate < m.end ? r.endDate : m.end
  return workingDaysBetween(s, e, weekend)
}
export const onLeaveToday = (r: LeaveRequest, day = today()) => r.status === 'approved' && r.startDate <= day && r.endDate >= day

// ---- balances --------------------------------------------------------------
export interface Balance { entitlement: number; used: number; pending: number; remaining: number }
/** Entitlement is prorated for staff whose contract starts inside the year. */
const prorate = (full: number, st: StaffMember, year: number) => {
  if (!st.startDate || !st.startDate.startsWith(String(year))) return full
  const m = Number(st.startDate.slice(5, 7)); return Math.round((full * (13 - m)) / 12)
}
export const balances = (st: StaffMember, requests: LeaveRequest[], settings: OrgSettings, year = new Date().getFullYear()): { annual: Balance; wfh: Balance; sick: number } => {
  const hr = hrSettings(settings)
  const mine = requests.filter((r) => r.staffId === st.id && r.startDate.startsWith(String(year)))
  const sum = (t: LeaveType, status: LeaveRequest['status']) => mine.filter((r) => r.type === t && r.status === status).reduce((s, r) => s + r.days, 0)
  const mk = (full: number, t: LeaveType): Balance => { const entitlement = prorate(full, st, year); const used = sum(t, 'approved'), pending = sum(t, 'pending'); return { entitlement, used, pending, remaining: Math.max(0, entitlement - used) } }
  return { annual: mk(st.annualLeaveDays ?? hr.annualLeaveDays, 'annual'), wfh: mk(st.wfhDays ?? hr.wfhDays, 'wfh'), sick: sum('sick', 'approved') }
}
export const reportsOf = (managerStaffId: string, staff: StaffMember[]) => staff.filter((s) => s.lineManagerId === managerStaffId && s.status !== 'left')
export const contractDaysLeft = (st: StaffMember) => st.endDate ? Math.ceil((d(st.endDate).getTime() - d(today()).getTime()) / 86400000) : null

// ---- timesheets -------------------------------------------------------------
/** Suggested allocation from the master salary plan: the active project lines paying this person, LoE % × working days. */
export function suggestTimesheet(st: StaffMember, budgets: ProjectBudget[], projects: Project[], period: string, workingDays: number): TimesheetLine[] {
  const out: TimesheetLine[] = []
  for (const b of budgets) for (const l of b.lines) {
    if (b.status !== 'active' || !l.staffIds?.includes(st.id)) continue
    if (!monthsOf(b.startDate, b.endDate).includes(period)) continue
    const p = projects.find((x) => x.budgetId === b.id || x.code === b.donorCode)
    out.push({ id: uid('tl_'), projectId: p?.id, projectCode: b.donorCode, description: `${l.code} · ${l.description}`, days: Math.round(workingDays * (l.pct ?? 1) * 2) / 2 })
  }
  const total = out.reduce((s, l) => s + l.days, 0)
  if (total > workingDays && total > 0) out.forEach((l) => { l.days = Math.round((l.days * workingDays) / total * 2) / 2 })
  return out
}
export const timesheetTotal = (t: Timesheet) => t.lines.reduce((s, l) => s + l.days, 0)
export function exportTimesheet(t: Timesheet, st: StaffMember, settings: OrgSettings, projects: Project[]) {
  const rows: (string | number)[][] = [
    [`${settings.orgName} — Monthly timesheet`], [`Staff: ${st.name} (${st.rhsNumber}) · ${st.position} · ${st.department}`], [`Period: ${monthLabel(t.period)} · Working days ${t.workingDays} · Leave ${t.leaveDays} · Status: ${TS_STATUS_LABEL[t.status]}`], [`Prepared by ${t.createdByName} · Document owner: Bilal Abbassi`], [],
    ['Project', 'Title', 'Budget line / description', 'Days', '% of working days'],
    ...t.lines.map((l) => [l.projectCode, projects.find((p) => p.id === l.projectId)?.title ?? '', l.description, l.days, t.workingDays ? Math.round((l.days / t.workingDays) * 100) / 100 : 0]),
    ['', '', 'Leave / public holidays', t.leaveDays, ''], ['', '', 'TOTAL', timesheetTotal(t) + t.leaveDays, ''],
    [], ['Staff acknowledgement', t.acknowledgedAt ?? ''], ['Approved by', t.approvedByName ?? '', t.approvedAt ?? ''],
  ]
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Timesheet')
  XLSX.writeFile(wb, `Timesheet_${st.rhsNumber}_${t.period}.xlsx`)
}

// ---- payroll ---------------------------------------------------------------
export function computePayslip(st: StaffMember, period: string, requests: LeaveRequest[], settings: OrgSettings): Omit<Payslip, 'id' | 'number' | 'paidAt' | 'generatedBy' | 'generatedByName'> {
  const hr = hrSettings(settings)
  const workingDays = workingDaysInMonth(period, hr.weekend)
  const approved = requests.filter((r) => r.staffId === st.id && r.status === 'approved')
  const leaveDays = approved.filter((r) => r.type !== 'wfh' && r.type !== 'unpaid').reduce((s, r) => s + requestDaysInMonth(r, period, hr.weekend), 0)
  const unpaidDays = approved.filter((r) => r.type === 'unpaid').reduce((s, r) => s + requestDaysInMonth(r, period, hr.weekend), 0)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const gross = st.monthlySalary
  const unpaidDeduction = r2(workingDays ? (gross / workingDays) * unpaidDays : 0)
  const base = gross - unpaidDeduction
  const socialSecurity = r2(base * (hr.socialSecurityPct / 100)), tax = r2(base * (hr.incomeTaxPct / 100))
  return { staffId: st.id, period, currency: st.currency, gross, allowances: 0, socialSecurity, tax, unpaidDeduction, otherDeductions: 0, net: r2(base - socialSecurity - tax), workingDays, leaveDays, unpaidDays }
}
export async function payslipPdf(p: Payslip, st: StaffMember, settings: OrgSettings): Promise<Uint8Array> {
  const doc = await PDFDocument.create(); const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const green = rgb(0, 0.52, 0.25), crimson = rgb(0.83, 0.12, 0.28), ink = rgb(0.08, 0.17, 0.22), grey = rgb(0.4, 0.47, 0.52)
  const money = (n: number) => `${p.currency} ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  let y = 790
  page.drawText('RESTORING', { x: 50, y, size: 16, font: bold, color: crimson }); page.drawText('HOPE', { x: 150, y, size: 16, font: bold, color: green })
  page.drawText(settings.tagline.toUpperCase(), { x: 50, y: y - 14, size: 7, font, color: grey })
  page.drawText('PAYSLIP', { x: 470, y, size: 18, font: bold, color: ink }); page.drawText(monthLabel(p.period), { x: 470, y: y - 16, size: 10, font, color: grey })
  page.drawLine({ start: { x: 50, y: y - 28 }, end: { x: 545, y: y - 28 }, thickness: 1, color: green })
  y -= 56
  const kv = (k: string, v: string, x: number, yy: number) => { page.drawText(k, { x, y: yy, size: 8, font, color: grey }); page.drawText(v, { x, y: yy - 12, size: 10.5, font: bold, color: ink }) }
  kv('Employee', st.name, 50, y); kv('RHS number', st.rhsNumber, 230, y); kv('Payslip no.', p.number, 400, y)
  kv('Position', st.position, 50, y - 34); kv('Department', st.department, 230, y - 34); kv('Country', st.country, 400, y - 34)
  kv('Contract', `${st.startDate}${st.endDate ? ' - ' + st.endDate : ' - open'}`, 50, y - 68); kv('Working days', `${p.workingDays} (leave ${p.leaveDays}, unpaid ${p.unpaidDays})`, 230, y - 68); kv('Paid on', p.paidAt.slice(0, 10), 400, y - 68)
  y -= 110
  const row = (label: string, val: string, yy: number, strong = false, color = ink) => { page.drawText(label, { x: 60, y: yy, size: 10, font: strong ? bold : font, color }); const w = (strong ? bold : font).widthOfTextAtSize(val, 10); page.drawText(val, { x: 535 - w, y: yy, size: 10, font: strong ? bold : font, color }) }
  page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 18, color: rgb(0.95, 0.97, 0.96) }); page.drawText('EARNINGS', { x: 60, y, size: 9, font: bold, color: green }); y -= 22
  row('Basic salary (gross)', money(p.gross), y); y -= 16; row('Allowances', money(p.allowances), y); y -= 22
  page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 18, color: rgb(0.99, 0.95, 0.96) }); page.drawText('DEDUCTIONS', { x: 60, y, size: 9, font: bold, color: crimson }); y -= 22
  row(`Social security (${hrSettings(settings).socialSecurityPct}%)`, money(p.socialSecurity), y); y -= 16; row(`Income tax (${hrSettings(settings).incomeTaxPct}%)`, money(p.tax), y); y -= 16
  row(`Unpaid leave (${p.unpaidDays} day(s))`, money(p.unpaidDeduction), y); y -= 16; row('Other deductions', money(p.otherDeductions), y); y -= 26
  page.drawLine({ start: { x: 50, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 1, color: ink })
  row('NET PAY', money(p.net), y - 6, true, green); y -= 50
  page.drawText(`Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC by the PCM & Grants Management Platform · ${settings.orgName} · ${settings.address}`, { x: 50, y: 70, size: 7.5, font, color: grey })
  page.drawText('This payslip is a system-generated document. Document owner: Bilal Abbassi.', { x: 50, y: 58, size: 7.5, font, color: grey })
  return doc.save()
}
export async function downloadPayslip(p: Payslip, st: StaffMember, settings: OrgSettings) {
  const bytes = await payslipPdf(p, st, settings)
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `Payslip_${st.rhsNumber}_${p.period}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ---- attendance --------------------------------------------------------------
export const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
export const hoursWorked = (a: AttendanceRecord) => a.checkOutAt ? Math.round(((new Date(a.checkOutAt).getTime() - new Date(a.checkInAt).getTime()) / 3600000) * 10) / 10 : null
/** Browser geolocation wrapped as a promise that never rejects — the viewer or the user may block it. */
export const capturePosition = (): Promise<{ lat?: number; lng?: number; accuracy?: number; status: AttendanceRecord['locationStatus'] }> =>
  new Promise((res) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return res({ status: 'unavailable' })
    const t = setTimeout(() => res({ status: 'unavailable' }), 9000)
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); res({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5, accuracy: Math.round(pos.coords.accuracy), status: 'captured' }) },
      (err) => { clearTimeout(t); res({ status: err.code === 1 ? 'denied' : 'unavailable' }) },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  })
