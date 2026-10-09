// ---------------------------------------------------------------------------
// Master budget coverage — how much of each organisational running-cost line
// is funded by project budgets (prorated to the master budget year).
// ---------------------------------------------------------------------------
import * as XLSX from 'xlsx'
import type { MasterBudget, MasterLine, OrgSettings, Project, ProjectBudget } from '@/types'
import { toUSD, fromUSD } from './tiers'
import { monthsOf } from './grants'

export const MASTER_CATEGORIES = ['Personnel — Amman support', 'Personnel — field', 'Office, IT & operations', 'Statutory, compliance & risk', 'Programme support', 'Capital & equipment', 'Other']

export interface CoveringLine { budget: ProjectBudget; project?: Project; line: ProjectBudget['lines'][number]; amount: number; prorated: number; status: ProjectBudget['status'] }
export interface Coverage { line: MasterLine; covered: number; pct: number; projects: number; gap: number; lines: CoveringLine[]; pipeline: number }

/** Fraction of a project budget's months that fall inside the year. */
export const yearShare = (b: ProjectBudget, year: number) => {
  const months = monthsOf(b.startDate, b.endDate)
  const inYear = months.filter((m) => m.startsWith(String(year))).length
  return months.length ? inYear / months.length : 1
}

export function coverageFor(mb: MasterBudget, budgets: ProjectBudget[], projects: Project[], settings: OrgSettings): Coverage[] {
  return mb.lines.map((ml) => {
    const lines: CoveringLine[] = []
    for (const b of budgets) for (const l of b.lines) {
      if (l.masterLineId !== ml.id) continue
      const amt = fromUSD(toUSD(l.amount, b.currency, settings), mb.currency, settings)
      lines.push({ budget: b, project: projects.find((p) => p.budgetId === b.id || p.code === b.donorCode), line: l, amount: amt, prorated: amt * yearShare(b, mb.year), status: b.status })
    }
    const funded = lines.filter((x) => x.status === 'active')
    const covered = funded.reduce((s, x) => s + x.prorated, 0)
    const pipeline = lines.filter((x) => x.status === 'draft').reduce((s, x) => s + x.prorated, 0)
    return { line: ml, covered, pct: ml.amount ? Math.round((covered / ml.amount) * 100) : 0, projects: new Set(funded.map((x) => x.budget.id)).size, gap: ml.amount - covered, lines, pipeline }
  })
}

export const masterCode = (year: number, n: number) => `MB-${year}-${String(n).padStart(3, '0')}`

export function exportMasterBudget(mb: MasterBudget, cov: Coverage[], settings: OrgSettings) {
  const aoa: (string | number | null)[][] = [[`${settings.orgName} — Master Budget ${mb.year} (${mb.currency}) · ${mb.status.toUpperCase()}`], [], ['Code', 'Account No.', 'Account / line', 'Category', 'Country', 'Budget holder', `Annual budget (${mb.currency})`, 'Covered by projects', 'Coverage %', 'Gap', 'Projects', 'Pipeline (drafts)', 'Notes']]
  for (const c of cov) aoa.push([c.line.code, c.line.accountNo ?? '', c.line.accountName, c.line.category, c.line.country, c.line.budgetHolderName ?? '', c.line.amount, Math.round(c.covered), c.pct / 100, Math.round(c.gap), c.projects, Math.round(c.pipeline), c.line.notes ?? ''])
  aoa.push(['TOTAL', '', '', '', '', '', cov.reduce((s, c) => s + c.line.amount, 0), Math.round(cov.reduce((s, c) => s + c.covered, 0)), cov.reduce((s, c) => s + c.line.amount, 0) ? cov.reduce((s, c) => s + c.covered, 0) / cov.reduce((s, c) => s + c.line.amount, 0) : 0, Math.round(cov.reduce((s, c) => s + c.gap, 0)), '', Math.round(cov.reduce((s, c) => s + c.pipeline, 0)), ''])
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 13 }, { wch: 10 }, { wch: 40 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 30 }]
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Master ${mb.year}`)
  const det: (string | number | null)[][] = [['Master line', 'Project code', 'Project', 'Project line', 'Description', 'Budget status', `Amount (${mb.currency})`, `Prorated to ${mb.year}`]]
  for (const c of cov) for (const l of c.lines) det.push([c.line.code, l.budget.donorCode, l.budget.name, l.line.code, l.line.description, l.status, Math.round(l.amount), Math.round(l.prorated)])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), 'Coverage detail')
  XLSX.writeFile(wb, `Master-Budget-${mb.year}.xlsx`)
}
