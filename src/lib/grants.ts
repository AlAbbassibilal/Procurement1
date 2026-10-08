// ---------------------------------------------------------------------------
// Grants / PCM helpers: stage rules, progress figures, IPTT & spending-plan
// generation, reminders, and template exports (budget · IPTT · work plan ·
// logframe) in the organisation's layouts.
// ---------------------------------------------------------------------------
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType } from 'docx'
import type { BudgetLine, IPTTEntry, LogframeIndicator, LogframeRow, Project, ProjectBudget, ProjectReport, ProjectStage, SpendingPlanEntry, OrgSettings } from '@/types'
import { uid } from './format'

export const STAGE_LABEL: Record<ProjectStage, string> = { development: 'Under development', submitted: 'Submitted', granted: 'Granted', active: 'Active', closed: 'Closed' }
export const STAGE_DESC: Record<ProjectStage, string> = {
  development: 'Proposal, logframe, work plan and budget are being prepared.',
  submitted: 'Submitted to the donor — IPTT generated from the logframe; awaiting decision.',
  granted: 'Agreement signed — budget approved and open to finance; spending plan and reporting calendar set.',
  active: 'Implementation — team updates work plan, IPTT, spending plan and reports.',
  closed: 'Closed out — stays in the annual and overall dashboards.',
}
export const PROJECT_STAGES_LIST: ProjectStage[] = ['development', 'submitted', 'granted', 'active', 'closed']
export const STAGE_INDEX = (s: ProjectStage) => (['development', 'submitted', 'granted', 'active', 'closed'] as ProjectStage[]).indexOf(s)

export const DEFAULT_SECTIONS = ['Background & problem statement', 'Objectives & expected results', 'Approach & activities', 'Target beneficiaries & locations', 'Partners & coordination', 'Monitoring, evaluation & learning', 'Risks & mitigation', 'Sustainability & exit', 'Organisational capacity']
export const SECTORS = ['Prosthetics & Orthotics', 'Physical rehabilitation', 'MHPSS', 'Nutrition', 'Health systems', 'Inclusive education', 'Livelihoods', 'Protection', 'Capacity building', 'Emergency response']

export const monthsOf = (start?: string, end?: string, fallback = 12): string[] => {
  const s = start ? new Date(start) : new Date(); const e = end ? new Date(end) : new Date(s.getFullYear(), s.getMonth() + fallback - 1, 1)
  const out: string[] = []; const d = new Date(s.getFullYear(), s.getMonth(), 1)
  while (d <= e && out.length < 60) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() + 1) }
  return out.length ? out : [`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`]
}
export const monthLabel = (p: string) => { const [y, m] = p.split('-').map(Number); return new Date(y!, m! - 1, 1).toLocaleString('en', { month: 'short', year: 'numeric' }) }

// ---- Logframe helpers --------------------------------------------------------
export const allIndicators = (lf: LogframeRow[]): LogframeIndicator[] => lf.flatMap((r) => r.indicators)
export const newLogframeRow = (level: LogframeRow['level'], code: string): LogframeRow => ({ id: uid('lf_'), level, code, narrative: '', indicators: [], mov: '', assumptions: '' })
export const newIndicator = (code: string, type: LogframeIndicator['type']): LogframeIndicator => ({ id: uid('ind_'), code, type, text: '', baseline: 0, target: 0, unit: '#' })

/** IPTT rows are the logframe indicators; existing entries are kept, new indicators are added. */
export function generateIPTT(p: Project): IPTTEntry[] {
  const ids = new Set(allIndicators(p.logframe).map((i) => i.id))
  return p.iptt.filter((e) => ids.has(e.indicatorId))
}
export const ipttAchieved = (p: Project, indicatorId: string) => p.iptt.filter((e) => e.indicatorId === indicatorId).reduce((s, e) => s + e.male + e.female + e.other, 0)
export function ipttProgress(p: Project) {
  const inds = allIndicators(p.logframe); if (!inds.length) return { pct: 0, count: 0, onTrack: 0 }
  const pcts = inds.map((i) => (i.target ? Math.min(100, (ipttAchieved(p, i.id) / i.target) * 100) : 0))
  return { pct: Math.round(pcts.reduce((s, x) => s + x, 0) / inds.length), count: inds.length, onTrack: pcts.filter((x) => x >= 50).length }
}

// ---- Work plan -----------------------------------------------------------------
export const weekKeys = (period: string) => [1, 2, 3, 4].map((w) => `${period}-W${w}`)
export function workplanProgress(p: Project) {
  const acts = p.workplan; if (!acts.length) return { pct: 0, completed: 0, ongoing: 0, planned: 0, total: 0 }
  const completed = acts.filter((a) => a.status === 'completed').length, ongoing = acts.filter((a) => a.status === 'ongoing').length
  return { pct: Math.round(acts.reduce((s, a) => s + (a.status === 'completed' ? 100 : a.progress), 0) / acts.length), completed, ongoing, planned: acts.length - completed - ongoing, total: acts.length }
}

// ---- Spending plan --------------------------------------------------------------
export function generateSpendingPlan(lines: BudgetLine[], months: string[]): SpendingPlanEntry[] {
  const out: SpendingPlanEntry[] = []
  for (const l of lines) { if (!l.amount) continue; const per = Math.round((l.amount / months.length) * 100) / 100; months.forEach((m, i) => out.push({ lineCode: l.code, period: m, amount: i === months.length - 1 ? Math.round((l.amount - per * (months.length - 1)) * 100) / 100 : per })) }
  return out
}
export const planTotal = (plan: SpendingPlanEntry[], f?: (e: SpendingPlanEntry) => boolean) => plan.filter(f ?? (() => true)).reduce((s, e) => s + e.amount, 0)

// ---- Reports -----------------------------------------------------------------------
export function generateReportingCalendar(p: Project): ProjectReport[] {
  const months = monthsOf(p.startDate, p.endDate)
  const out: ProjectReport[] = []
  const endOf = (period: string) => { const [y, m] = period.split('-').map(Number); return new Date(y!, m!, 0) }
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  for (let i = 2; i < months.length; i += 3) { const d = endOf(months[i]!); d.setDate(d.getDate() + 15); out.push({ id: uid('rep_'), type: 'narrative', title: `Quarterly narrative report Q${Math.floor(i / 3) + 1}`, period: `${monthLabel(months[i - 2]!)} – ${monthLabel(months[i]!)}`, dueDate: iso(d), reminderDays: 14, status: 'upcoming', attachments: [] }); out.push({ id: uid('rep_'), type: 'financial', title: `Quarterly financial report Q${Math.floor(i / 3) + 1}`, period: `${monthLabel(months[i - 2]!)} – ${monthLabel(months[i]!)}`, dueDate: iso(d), reminderDays: 14, status: 'upcoming', attachments: [] }) }
  const last = endOf(months[months.length - 1]!); last.setDate(last.getDate() + 60)
  out.push({ id: uid('rep_'), type: 'narrative', title: 'Final narrative report', dueDate: iso(last), reminderDays: 30, status: 'upcoming', attachments: [] }, { id: uid('rep_'), type: 'financial', title: 'Final financial report', dueDate: iso(last), reminderDays: 30, status: 'upcoming', attachments: [] })
  return out
}
export const reportLiveStatus = (r: ProjectReport, now = new Date()): ReportStatus => {
  if (r.status === 'submitted' || r.status === 'approved') return r.status
  const due = new Date(r.dueDate); const days = (due.getTime() - now.getTime()) / 86400000
  return days < 0 ? 'overdue' : days <= r.reminderDays ? 'due' : 'upcoming'
}
type ReportStatus = ProjectReport['status']

// ---- Mentions ------------------------------------------------------------------------
export const parseMentions = (text: string, users: { id: string; name: string }[]) => users.filter((u) => new RegExp(`@${u.name.split(' ')[0]}\\b`, 'i').test(text) || text.includes(`@${u.name}`)).map((u) => u.id)

// ============================================================================
// Exports in the organisation's templates
// ============================================================================
const col = (i: number) => XLSX.utils.encode_col(i)
const F = (f: string, v: number | string = 0) => ({ t: typeof v === 'number' ? 'n' as const : 's' as const, f, v })

/** RHS Project Budget Template: Summary · Direct Cost · Admin Cost · Budget Narrative · Accounts & Activity */
export function exportBudgetTemplate(p: Project, b: ProjectBudget | undefined, settings: OrgSettings) {
  const lines = b?.lines ?? []
  const ccy = b?.currency ?? p.currency
  const wb = XLSX.utils.book_new()
  const costSheet = (name: string, costType: 'direct' | 'admin', pctLabel: string) => {
    const rows: unknown[][] = [
      [`RESTORING HOPE - Project Budget: ${costType === 'direct' ? 'Direct Cost' : 'Admin / Indirect Cost'}`], [p.title], ['Project Duration:', null, null, p.duration ?? ''], ['Location:', null, null, p.locations ?? '', null, null, null, 'Currency:', ccy],
      ['Code', 'Activity Code', 'Account No.', 'Location', 'Position / Line Item', 'Unit', '# of Units', 'Frequency\n(Months)', `Unit Cost\n(${ccy})`, pctLabel, `Total (${ccy})`],
    ]
    const sections = [...new Set(lines.filter((l) => (l.costType ?? 'direct') === costType).map((l) => l.category ?? (costType === 'direct' ? 'A. Direct costs' : 'A. Indirect costs')))]
    const subtotalRows: number[] = []
    for (const sec of sections) {
      rows.push([sec]); const first = rows.length + 1
      for (const l of lines.filter((x) => (x.costType ?? 'direct') === costType && (x.category ?? (costType === 'direct' ? 'A. Direct costs' : 'A. Indirect costs')) === sec)) { const r = rows.length + 1; rows.push([l.code, l.activityCode ?? '', l.accountNo ?? '', l.location ?? '', l.description, l.unit ?? '', l.units ?? 1, l.frequency ?? 1, l.unitCost ?? l.amount, l.pct ?? 1, F(`G${r}*H${r}*I${r}*J${r}`, l.amount)]) }
      const last = rows.length; const sr = rows.length + 1; subtotalRows.push(sr)
      rows.push([`Subtotal — ${sec.replace(/^[A-Z]\.\s*/, '')}`, null, null, null, null, null, null, null, null, null, F(last >= first ? `SUM(K${first}:K${last})` : '0', lines.filter((x) => (x.costType ?? 'direct') === costType && (x.category ?? '') === sec).reduce((s, x) => s + x.amount, 0))]); rows.push([])
    }
    const tr = rows.length + 1
    rows.push([costType === 'direct' ? 'TOTAL DIRECT COST' : 'TOTAL ADMIN / INDIRECT COST', null, null, null, null, null, null, null, null, null, F(subtotalRows.length ? subtotalRows.map((r) => `K${r}`).join('+') : '0', lines.filter((x) => (x.costType ?? 'direct') === costType).reduce((s, x) => s + x.amount, 0))])
    const ws = XLSX.utils.aoa_to_sheet(rows as (string | number | null)[][]); ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 46 }, { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, name); return tr
  }
  // Summary first (sheet order as template), refs filled after
  const summary: unknown[][] = [[settings.orgName.toUpperCase()], ['PROJECT BUDGET TEMPLATE'], [], ['Project Title', null, p.title], ['Program Summary', null, p.summary], ['Project Duration', null, p.duration ?? ''], ['Locations', null, p.locations ?? ''], ['Project Code', null, p.code], ['Organization', null, `${settings.orgName} (${settings.orgShort})`], ['Currency', null, ccy], [], ['BUDGET SUMMARY BY CATEGORY'], ['#', 'Budget Category', `Amount (${ccy})`, '% of Total']]
  const wsS = XLSX.utils.aoa_to_sheet(summary as (string | number | null)[][]); XLSX.utils.book_append_sheet(wb, wsS, 'Summary')
  const dRow = costSheet('Direct Cost', 'direct', 'LoE %'), aRow = costSheet('Admin Cost', 'admin', '% Allocated')
  const direct = lines.filter((l) => (l.costType ?? 'direct') === 'direct').reduce((s, l) => s + l.amount, 0), admin = lines.filter((l) => l.costType === 'admin').reduce((s, l) => s + l.amount, 0)
  XLSX.utils.sheet_add_aoa(wsS, [[1, 'Direct Cost', F(`'Direct Cost'!K${dRow}`, direct), F('C14/C$16', direct / ((direct + admin) || 1))], [2, 'Admin / Indirect Cost', F(`'Admin Cost'!K${aRow}`, admin), F('C15/C$16', admin / ((direct + admin) || 1))], [null, 'TOTAL PROJECT BUDGET', F('SUM(C14:C15)', direct + admin), 1], [], ['BUDGET SUMMARY BY ACCOUNT'], ['Account No.', 'Account Name', `Amount (${ccy})`, '% of Total']], { origin: 'A14' })
  const accts = [...new Set(lines.map((l) => l.accountNo).filter(Boolean))] as string[]
  XLSX.utils.sheet_add_aoa(wsS, accts.map((a) => [a, lines.find((l) => l.accountNo === a)?.description ?? '', lines.filter((l) => l.accountNo === a).reduce((s, l) => s + l.amount, 0), (lines.filter((l) => l.accountNo === a).reduce((s, l) => s + l.amount, 0)) / ((direct + admin) || 1)]), { origin: 'A21' })
  wsS['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 40 }, { wch: 12 }]
  const narr: unknown[][] = [[`RESTORING HOPE — Budget Narrative & Calculation`], ['Code', 'Budget Line', `Amount (${ccy})`, 'How it is Calculated', 'Budget Narrative'], ['DIRECT COST'], ...lines.filter((l) => (l.costType ?? 'direct') === 'direct').map((l) => [l.code, l.description, l.amount, `${l.units ?? 1} ${l.unit ?? ''} × ${l.frequency ?? 1} × ${(l.unitCost ?? l.amount).toLocaleString()}${l.pct != null && l.pct !== 1 ? ` × ${Math.round(l.pct * 100)}%` : ''}`, '']), ['ADMIN / INDIRECT COST'], ...lines.filter((l) => l.costType === 'admin').map((l) => [l.code, l.description, l.amount, `${l.units ?? 1} ${l.unit ?? ''} × ${l.frequency ?? 1} × ${(l.unitCost ?? l.amount).toLocaleString()}${l.pct != null && l.pct !== 1 ? ` × ${Math.round(l.pct * 100)}%` : ''}`, ''])]
  const wsN = XLSX.utils.aoa_to_sheet(narr as (string | number | null)[][]); wsN['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 40 }, { wch: 60 }]; XLSX.utils.book_append_sheet(wb, wsN, 'Budget Narrative')
  const acc: unknown[][] = [['Accounts Number', 'Account', null, 'Location', 'Code'], ...[['Program Field Staff', 2601], ['Management Field Staff', 2602], ['Head Office staff', 2603], ['Support Field staff', 2604], ['Staff Transportation', 2605], ['Ben Transportation', 2606], ['Car Rent', 2607], ['Fuel for generator or Car', 2608], ['IT Equipment', 2609], ['Project / Center Equipments', 2610], ['Prosthetics components', 2611], ['Media Equipments', 2612], ['Consultant', 2613], ['Daily worker', 2614], ['Training for staff', 2615], ['International Travel', 2616], ['Partnership', 2617], ['Subscription', 2618], ['Office Rent', 2619], ['Stationary', 2620], ['Workshops / Seminars / Team Building', 2621], ['Legal Fees', 2622], ['Bank Fees', 2623], ['Insurance', 2624], ['Telecommunication and Internet Cost', 2625], ['Nutrition and food', 2626], ['Social Security', 2627], ['Contingency', 2628]].map((r, i) => [r[0], r[1], null, ['Amman', 'Gaza', 'Sudan', 'Syria', 'Lebanon', 'West Bank'][i] ?? null, i < 6 ? i + 1 : null])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(acc as (string | number | null)[][]), 'Accounts & Activity')
  XLSX.writeFile(wb, `${p.code}-Project-Budget.xlsx`)
}

/** Annex IPTT: 'Partner Logical framework' + 'IPTT' with Male/Female/Other per month. */
export function exportIPTT(p: Project) {
  const inds = allIndicators(p.logframe); const months = monthsOf(p.startDate, p.endDate)
  const wb = XLSX.utils.book_new()
  const lf: unknown[][] = [['Partners logicial framework'], [], [], [], ['Project Code', 'Activity', 'indicator #', 'indicator Type', 'indicator', 'Baseline', 'Target', 'Indicator definition', 'How to Calculate', 'MoVs', 'Disaggregation Requirements', 'Responsible', 'Data collection method', 'Frequency of data collection']]
  inds.forEach((i, k) => { const row = p.logframe.find((r) => r.indicators.some((x) => x.id === i.id)); lf.push([k === 0 ? p.code : null, row?.code ?? '', i.code, i.type === 'outcome' ? 'OutCome' : i.type === 'output' ? 'OutPut' : 'Impact', i.text, i.baseline, i.target, i.definition ?? '', i.calculation ?? '', i.mov ?? row?.mov ?? '', i.disaggregation ?? '', i.responsible ?? '', i.method ?? '', i.frequency ?? '']) })
  const wsL = XLSX.utils.aoa_to_sheet(lf as (string | number | null)[][]); wsL['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 48 }, { wch: 9 }, { wch: 9 }, { wch: 40 }, { wch: 24 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsL, 'Partner Logical framework')
  const head = ['Responsible person', 'Indicator#', 'Indicator', 'Indicator definition', 'Indicator calculation', 'Disaggregation', 'Baseline value', 'Target', 'Achieved Female', 'Achieved Male', 'Progress update', '% Progress update', 'Male', 'Female', 'Other']
  const r5: unknown[] = Array(12).fill(null).concat(['Beneficiary Disaggregations', null, null]); const r6: unknown[] = Array(12).fill(null).concat(['Total', null, null]); const r7: unknown[] = [...head]
  months.forEach((m) => { r5.push(monthLabel(m), null, null); r6.push('Beneficiaries', null, null); r7.push('Male', 'Female', 'Other') })
  const ip: unknown[][] = [[null, `Partner IPTT Template\nProject Number: ${p.code}`], [], [], [], r5, r6, r7, []]
  inds.forEach((i, k) => {
    const r = ip.length + 1; const lfRow = k + 6
    const mCols = months.map((_, mi) => col(15 + mi * 3)), fCols = months.map((_, mi) => col(16 + mi * 3)), oCols = months.map((_, mi) => col(17 + mi * 3))
    const row: unknown[] = [i.responsible ?? '', F(`'Partner Logical framework'!C${lfRow}`, i.code), F(`'Partner Logical framework'!E${lfRow}`, i.text), F(`'Partner Logical framework'!H${lfRow}`, i.definition ?? ''), i.calculation ?? '', i.disaggregation ?? '', i.baseline, F(`'Partner Logical framework'!G${lfRow}`, i.target), F(`N${r}`, 0), F(`M${r}`, 0), F(`SUM(I${r},J${r})`, 0), F(`IF(H${r}=0,0,K${r}/H${r})`, 0), F(`SUM(${mCols.map((c) => `${c}${r}`).join(',')})`, 0), F(`SUM(${fCols.map((c) => `${c}${r}`).join(',')})`, 0), F(`SUM(${oCols.map((c) => `${c}${r}`).join(',')})`, 0)]
    months.forEach((m) => { const e = p.iptt.find((x) => x.indicatorId === i.id && x.period === m); row.push(e?.male ?? 0, e?.female ?? 0, e?.other ?? 0) })
    ip.push(row)
  })
  const wsI = XLSX.utils.aoa_to_sheet(ip as (string | number | null)[][]); wsI['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 44 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, ...months.flatMap(() => [{ wch: 7 }, { wch: 7 }, { wch: 7 }])]
  wsI['!merges'] = months.map((_, mi) => ({ s: { r: 4, c: 15 + mi * 3 }, e: { r: 4, c: 17 + mi * 3 } })); wsI['!freeze'] = { xSplit: 3, ySplit: 7 }
  XLSX.utils.book_append_sheet(wb, wsI, 'IPTT')
  XLSX.writeFile(wb, `${p.code}-IPTT.xlsx`)
}

/** Work plan: sections, activities, status and a 4-weeks-per-month grid (C = completed, O = ongoing, P = planned). */
export function exportWorkplan(p: Project) {
  const months = monthsOf(p.startDate, p.endDate)
  const rows: unknown[][] = [[`Project Code: ${p.code}\nDonor: ${p.donorName}`, null, null, null, null, null, null, null, null, null, null, `Workplan – ${p.title}`], [null, null, null, null, 'Workplan Key:', 'Completed (C)', 'Ongoing (O)', 'Planned (P)'], []]
  const h4: unknown[] = ['Project\'s Activities', 'Description', 'Budget Line', 'Status']; const h5: unknown[] = [null, null, null, null]
  months.forEach((m) => { h4.push(monthLabel(m), null, null, null); h5.push('Week 1', 'Week 2', 'Week 3', 'Week 4') })
  rows.push(h4, h5)
  const sections = [...new Set(p.workplan.map((a) => a.section))]
  for (const sec of sections) { rows.push([sec]); for (const a of p.workplan.filter((x) => x.section === sec)) { const r: unknown[] = [a.title, a.description ?? '', a.budgetLine ?? '', a.status === 'completed' ? 'Completed' : a.status === 'ongoing' ? 'Ongoing' : 'Planned']; months.forEach((m) => weekKeys(m).forEach((k) => r.push(a.weeks[k] ?? ''))); rows.push(r) } }
  const ws = XLSX.utils.aoa_to_sheet(rows as (string | number | null)[][]); ws['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 11 }, { wch: 11 }, ...months.flatMap(() => [{ wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }])]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 2, c: 3 } }, { s: { r: 0, c: 11 }, e: { r: 2, c: 11 + months.length * 4 - 8 } }, ...months.map((_, i) => ({ s: { r: 3, c: 4 + i * 4 }, e: { r: 3, c: 7 + i * 4 } }))]; ws['!freeze'] = { xSplit: 4, ySplit: 5 }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); XLSX.writeFile(wb, `${p.code}-Workplan.xlsx`)
}

/** Annex 2 — Logical Framework (Word). */
export async function exportLogframeDocx(p: Project, settings: OrgSettings): Promise<Blob> {
  const cell = (text: string, opts: { bold?: boolean; shade?: string; width?: number } = {}) => new TableCell({ width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined, shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: 'auto' } : undefined, children: text.split('\n').map((t) => new Paragraph({ children: [new TextRun({ text: t, bold: opts.bold, size: 18, font: 'Arial' })] })) })
  const header = new TableRow({ tableHeader: true, children: ['Results Level', 'Description / Narrative Summary', 'Indicators & Targets', 'Means of Verification (MoV)', 'Key Assumptions'].map((t, i) => cell(t, { bold: true, shade: 'DCEFE3', width: [14, 26, 26, 18, 16][i] })) })
  const rows = p.logframe.map((r) => new TableRow({ children: [cell(r.code, { bold: true }), cell(r.narrative), cell(r.indicators.map((i) => `${i.code} ${i.text}${i.target ? ` — Target: ${i.target}${i.unit === '%' ? '%' : ''}` : ''}${i.baseline ? ` (baseline ${i.baseline})` : ''}`).join('\n')), cell(r.indicators.map((i) => i.mov).filter(Boolean).join('\n') || (r.mov ?? '')), cell(r.assumptions ?? '')] }))
  const line = (t: string, bold = false) => new Paragraph({ children: [new TextRun({ text: t, bold, size: 20, font: 'Arial' })] })
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ children: [new TextRun({ text: `${settings.orgName} (${settings.orgShort})`, bold: true, size: 26, font: 'Arial', color: '00853F' })] }),
    line(settings.tagline), new Paragraph({ text: 'Annex 2 — Logical Framework', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT }),
    line(`Project: ${p.title}`, true), line(`Submitted to: ${p.proposal.submittedTo ?? p.donorName}`), line(`Reference: ${p.proposal.reference ?? p.code}`), line(`Duration: ${p.duration ?? ''}`), line(`Date / Version: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} | ${p.proposal.version ?? 'V0.1'}`), line('Confidentiality: External'), new Paragraph({ text: '' }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: '999999' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999' }, left: { style: BorderStyle.SINGLE, size: 4, color: '999999' }, right: { style: BorderStyle.SINGLE, size: 4, color: '999999' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '999999' }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '999999' } }, rows: [header, ...rows] }),
    new Paragraph({ text: '' }), line(`Prepared on the ${settings.orgShort} PCM & Grants Management Platform · Document owner: ${p.ownerName}`),
  ] }] })
  return Packer.toBlob(doc)
}

export const download = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000) }
