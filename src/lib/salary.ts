// ---------------------------------------------------------------------------
// Master salary plan — which project pays which staff member (by RHS number),
// how much of each salary is covered in a year, and the month-by-month
// salary spending plan derived from the projects' spending plans.
// ---------------------------------------------------------------------------
import * as XLSX from 'xlsx'
import type { BudgetLine, OrgSettings, Project, ProjectBudget, StaffMember } from '@/types'
import { toUSD, fromUSD } from './tiers'
import { monthsOf, monthLabel } from './grants'

export const STAFF_STATUS_LABEL = { active: 'Active', planned: 'New — to recruit', left: 'Left' } as const
export const STAFF_STATUS_TONE = { active: 'bg-brand-100 text-brand-800', planned: 'bg-sun-100 text-sun-700', left: 'bg-ink-100 text-ink-500' } as const
export const CONTRACT_LABEL = { full_time: 'Full-time', part_time: 'Part-time', consultant: 'Consultant', volunteer: 'Volunteer' } as const

/** A budget line that pays a salary: explicit kind, or auto-detected from the template's personnel sections. */
export const isSalaryLine = (l: BudgetLine) =>
  l.kind === 'salary' || (l.kind !== 'other' && (/personnel|salar|staff|wages|payroll/i.test(l.category ?? '') || /^person/i.test(l.unit ?? '') || /^26\d\d$/.test(l.accountNo ?? '')))
/** Salary lines that still need an RHS number or a "new position" flag — blocks submission. */
export const unassignedSalaryLines = (lines: BudgetLine[]) => lines.filter((l) => isSalaryLine(l) && !l.newStaff && !(l.staffIds?.length))
/** Number of people a line pays (one per unit). */
export const headcount = (l: BudgetLine) => Math.max(1, Math.min(20, Math.round(l.units ?? 1)))

export const rhsNumber = (n: number) => `RHS-${String(n).padStart(4, '0')}`
export const nextRhsNumber = (staff: StaffMember[]) => rhsNumber(staff.reduce((m, s) => Math.max(m, Number(s.rhsNumber.replace(/\D/g, '')) || 0), 0) + 1)

export interface StaffCoverLine { budget: ProjectBudget; project?: Project; line: BudgetLine; share: number; amount: number; prorated: number; loe: number; status: ProjectBudget['status'] }
export interface StaffCoverage { staff: StaffMember; annual: number; covered: number; pipeline: number; pct: number; loe: number; gap: number; lines: StaffCoverLine[]; projects: number }

/** Months (YYYY-MM) of the staff contract that fall inside the year — 12 if open-ended. */
export const contractMonths = (s: StaffMember, year: number): string[] => {
  const start = s.startDate && s.startDate > `${year}-01` ? s.startDate.slice(0, 7) : `${year}-01`
  const end = s.endDate && s.endDate < `${year}-12-31` ? s.endDate.slice(0, 7) : `${year}-12`
  if (start > `${year}-12` || end < `${year}-01`) return []
  const out: string[] = []
  for (let m = Number(start.slice(5)); m <= Number(end.slice(5)); m++) out.push(`${year}-${String(m).padStart(2, '0')}`)
  return out
}
const r2 = (n: number) => Math.round(n * 100) / 100

export function staffCoverage(staff: StaffMember[], budgets: ProjectBudget[], projects: Project[], year: number, settings: OrgSettings): StaffCoverage[] {
  return staff.map((st) => {
    const lines: StaffCoverLine[] = []
    for (const b of budgets) for (const l of b.lines) {
      if (!l.staffIds?.includes(st.id)) continue
      const share = 1 / l.staffIds.length
      const amt = fromUSD(toUSD(l.amount * share, b.currency, settings), st.currency, settings)
      const months = monthsOf(b.startDate, b.endDate)
      const inYear = months.filter((m) => m.startsWith(String(year))).length
      lines.push({ budget: b, project: projects.find((p) => p.budgetId === b.id || p.code === b.donorCode), line: l, share, amount: r2(amt), prorated: r2(months.length ? amt * (inYear / months.length) : amt), loe: inYear ? (l.pct ?? 1) : 0, status: b.status })
    }
    const funded = lines.filter((x) => x.status === 'active')
    const annual = st.monthlySalary * contractMonths(st, year).length
    const covered = r2(funded.reduce((s, x) => s + x.prorated, 0))
    return { staff: st, annual, covered, pipeline: r2(lines.filter((x) => x.status === 'draft').reduce((s, x) => s + x.prorated, 0)), pct: annual ? Math.round((covered / annual) * 100) : 0, loe: Math.round(funded.reduce((s, x) => s + x.loe, 0) * 100), gap: r2(Math.max(0, annual - covered)), lines, projects: new Set(funded.map((x) => x.budget.id)).size }
  })
}

export interface MonthCell { period: string; salary: number; covered: number; byProject: { code: string; projectId?: string; amount: number }[] }
/** Month-by-month salary spending for one staff member in a year: the project's spending plan where it exists, otherwise the line spread evenly over the project months. */
export function staffMonthly(cov: StaffCoverage, year: number, settings: OrgSettings): MonthCell[] {
  const st = cov.staff
  const contract = new Set(contractMonths(st, year))
  return Array.from({ length: 12 }, (_, i) => {
    const period = `${year}-${String(i + 1).padStart(2, '0')}`
    const byProject: MonthCell['byProject'][number][] = []
    for (const x of cov.lines) {
      if (x.status !== 'active') continue
      const months = monthsOf(x.budget.startDate, x.budget.endDate)
      if (!months.includes(period)) continue
      const planned = x.project?.spendingPlan.filter((e) => e.lineCode === x.line.code) ?? []
      const raw = planned.length ? (planned.find((e) => e.period === period)?.amount ?? 0) * x.share : (x.line.amount * x.share) / months.length
      const amount = r2(fromUSD(toUSD(raw, x.budget.currency, settings), st.currency, settings))
      if (amount) byProject.push({ code: x.budget.donorCode, projectId: x.project?.id, amount })
    }
    return { period, salary: contract.has(period) ? st.monthlySalary : 0, covered: r2(byProject.reduce((s, b) => s + b.amount, 0)), byProject }
  })
}

export function exportSalaryPlan(cov: StaffCoverage[], year: number, settings: OrgSettings, preparedBy: string) {
  const wb = XLSX.utils.book_new()
  const head = ['RHS no.', 'Name', 'Position', 'Department', 'Country', 'Status', 'Contract', 'Monthly salary', 'Currency', 'Annual cost ' + year, 'Covered by projects', 'Coverage %', 'LoE allocated %', 'Gap', '# projects', 'Projects']
  const rows = cov.map((c) => [c.staff.rhsNumber, c.staff.name || '(to recruit)', c.staff.position, c.staff.department, c.staff.country, STAFF_STATUS_LABEL[c.staff.status], CONTRACT_LABEL[c.staff.contractType], c.staff.monthlySalary, c.staff.currency, c.annual, Math.round(c.covered), c.pct / 100, c.loe / 100, Math.round(c.gap), c.projects, c.lines.filter((l) => l.status === 'active').map((l) => `${l.budget.donorCode} ${l.line.code} (${Math.round((l.line.pct ?? 1) * 100)}%)`).join('; ')])
  const cover = XLSX.utils.aoa_to_sheet([[`${settings.orgName} — Master salary plan ${year}`], [`Prepared by ${preparedBy} · Document owner: Bilal Abbassi`], [], head, ...rows])
  XLSX.utils.book_append_sheet(wb, cover, 'Salary coverage')
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const plan = [['RHS no.', 'Name', 'Position', ...months.map(monthLabel), 'Total covered', 'Total salary', 'Gap'], ...cov.map((c) => { const m = staffMonthly(c, year, settings); const tc = m.reduce((s, x) => s + x.covered, 0), ts = m.reduce((s, x) => s + x.salary, 0); return [c.staff.rhsNumber, c.staff.name || '(to recruit)', c.staff.position, ...m.map((x) => Math.round(x.covered)), Math.round(tc), ts, Math.round(ts - tc)] })]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plan), 'Spending plan')
  const detail = [['RHS no.', 'Name', 'Project', 'Budget line', 'Description', 'LoE %', 'Line amount (share)', `Prorated ${year}`, 'Budget status'], ...cov.flatMap((c) => c.lines.map((l) => [c.staff.rhsNumber, c.staff.name, l.budget.donorCode, l.line.code, l.line.description, (l.line.pct ?? 1), Math.round(l.amount), Math.round(l.prorated), l.status]))]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), 'Coverage detail')
  XLSX.writeFile(wb, `RHS_Master_Salary_Plan_${year}.xlsx`)
}
