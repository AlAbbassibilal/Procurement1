// ---------------------------------------------------------------------------
// Approved-budget extraction (Excel) and Budget-vs-Actual (BvA)
//
// Two organisation templates are recognised:
//   • RHS Project Budget Template  — sheets "Summary", "Direct Cost", "Admin Cost"
//     (Code · Activity Code · Account No. · Location · Line item · Unit · # Units ·
//      Frequency · Unit cost · LoE/% allocated · Total)
//   • Annex 1 Project Budget / BvA — "Project Budget" sheet
//     (Budget Line · Location · Description · UNIT · # of Unit · Freq · curr ·
//      unit price · Covering % · Total · Total in Euro · Total in USD) and the BvA
//     sheet with Actual / Remaining / Burn / Forecast / Commitments columns.
// Any other tabular layout falls back to header detection + column mapping.
// ---------------------------------------------------------------------------
import * as XLSX from 'xlsx'
import { fleetActuals } from './supply'
import type { BudgetLine, Currency, Invoice, OrgSettings, ProjectBudget, PurchaseOrder, PurchaseRequisition, TripRequest } from '@/types'
import { uid } from './format'

export type Cell = string | number | null
export interface ParsedSheet { name: string; rows: Cell[][] }
export type MapKey = 'code' | 'description' | 'category' | 'amount' | 'quantity' | 'unitCost' | 'frequency' | 'pct' | 'unit' | 'location' | 'activityCode' | 'accountNo'
export type Mapping = Record<MapKey, number>   // column index or -1
export const MAP_KEYS: MapKey[] = ['code', 'description', 'amount', 'category', 'location', 'unit', 'quantity', 'frequency', 'unitCost', 'pct', 'activityCode', 'accountNo']
export const emptyMapping = (): Mapping => Object.fromEntries(MAP_KEYS.map((k) => [k, -1])) as Mapping

export function readWorkbook(buf: ArrayBuffer): ParsedSheet[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: false }) as Cell[][]
    return { name, rows: rows.map((r) => r.map((c) => (typeof c === 'string' ? c.replace(/\s+/g, ' ').trim() : c))) }
  })
}

const str = (c: Cell) => (c == null ? '' : String(c).trim())
export const num = (c: Cell): number => {
  if (typeof c === 'number') return c
  if (typeof c === 'string') { const n = Number(c.replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
  return 0
}
const isHeading = (r: Cell[]) => r.filter((c) => c != null && c !== '').length === 1 && typeof r.find((c) => c != null && c !== '') === 'string'
const isSubtotal = (t: string) => /^(sub[\s-]*)?total\b|^grand[\s-]*total|^sum\b/i.test(t)
const isGrandTotal = (t: string) => /^grand[\s-]*total/i.test(t) || /^TOTAL\b/.test(t)

// ---------------------------------------------------------------------------
// Project metadata (Summary sheet / header block)
// ---------------------------------------------------------------------------
export interface BudgetMeta { donorCode?: string; name?: string; donor?: string; currency?: Currency; duration?: string; locations?: string; totalBudget?: number; summary?: string }

export function detectMeta(sheets: ParsedSheet[]): BudgetMeta {
  const m: BudgetMeta = {}
  const take = (r: Cell[], i: number) => { for (let j = i + 1; j < r.length; j++) if (r[j] != null && r[j] !== '') return r[j]; return null }
  for (const sh of sheets) for (const r of sh.rows.slice(0, Math.min(15, Math.max(detectHeaderRow(sh.rows), 1)))) for (let i = 0; i < r.length; i++) {
    const label = str(r[i]).toLowerCase(); if (!label) continue
    const v = take(r, i); const vs = str(v)
    if (!m.donorCode && /^project\s*code/.test(label) && vs) m.donorCode = vs
    else if (!m.name && /^project\s*title/.test(label) && vs) m.name = vs
    else if (!m.summary && /^program(me)?\s*summary/.test(label) && vs) m.summary = vs
    else if (!m.donor && /^donor$/.test(label) && vs) m.donor = vs
    else if (!m.currency && /^currency/.test(label) && /^(USD|JOD|EUR)$/i.test(vs)) m.currency = vs.toUpperCase() as Currency
    else if (!m.duration && /^project\s*duration\s*:?$/.test(label) && vs) m.duration = vs
    else if (!m.locations && /^locations?\s*:?$/.test(label) && vs) m.locations = vs
    else if (!m.totalBudget && /total\s*project\s*budget/.test(label) && num(v) > 0) { m.totalBudget = num(v); const cur = str(r[i + 2]); if (!m.currency && /^(USD|JOD|EUR)$/i.test(cur)) m.currency = cur.toUpperCase() as Currency }
    // "Project Duration 12 Months" packed into one cell
    if (!m.duration && /^project\s*duration\s*:?\s+\S/.test(label)) m.duration = str(r[i]).replace(/^project\s*duration\s*:?\s*/i, '')
  }
  return m
}

// ---------------------------------------------------------------------------
// RHS Project Budget Template (Direct Cost + Admin Cost)
// ---------------------------------------------------------------------------
export const isRhsTemplate = (sheets: ParsedSheet[]) => sheets.some((s) => /^direct\s*cost/i.test(s.name)) && sheets.some((s) => /^admin\s*cost/i.test(s.name))

export function extractRhsTemplate(sheets: ParsedSheet[], warnings?: string[]): BudgetLine[] {
  const out: BudgetLine[] = []
  for (const costType of ['direct', 'admin'] as const) {
    const sh = sheets.find((s) => (costType === 'direct' ? /^direct\s*cost/i : /^admin\s*cost/i).test(s.name))
    if (!sh) continue
    const h = detectHeaderRow(sh.rows)
    const m = guessMapping(sh.rows[h] ?? [])
    out.push(...extractLines(sh.rows, h, m, warnings).map((l) => ({ ...l, costType })))
  }
  return out
}

// ---------------------------------------------------------------------------
// Generic tabular extraction
// ---------------------------------------------------------------------------
const HEADER_HINTS = /budget|line|code|description|amount|total|unit|qty|quantity|cost|item|activity|category|location|freq/i

export function sheetScore(rows: Cell[][]): number {
  const h = detectHeaderRow(rows)
  const header = rows[h] ?? []
  const hits = header.filter((c) => typeof c === 'string' && HEADER_HINTS.test(c)).length
  const numericRows = rows.slice(h + 1).filter((r) => r.some((c) => typeof c === 'number')).length
  return hits * 10 + Math.min(numericRows, 20)
}

/** Header row = first row with ≥ 3 text cells where several look like budget headers. */
export function detectHeaderRow(rows: Cell[][]): number {
  let best = 0, bestScore = 0
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const texts = rows[i]!.filter((c) => typeof c === 'string' && c.length > 0) as string[]
    if (texts.length < 3) continue
    const score = texts.filter((t) => HEADER_HINTS.test(t)).length
    if (score > bestScore) { best = i; bestScore = score }
    if (score >= 4) return i
  }
  return best
}

const GUESS: Record<MapKey, RegExp> = {
  unitCost: /unit\s*(cost|price|rate)|^rate$|^price$/i,
  quantity: /#\s*(of\s*)?units?|^qty|quantity|^no\.?\s*of/i,
  frequency: /freq|^months?$|^duration$/i,
  pct: /loe|%|percent|covering|allocat/i,
  activityCode: /activity\s*code|^activity$/i,
  accountNo: /account\s*(no|number|code)|^account$/i,
  location: /location|^site$/i,
  unit: /^units?$|^unit\s*of\s*measure|^uom$/i,
  code: /^(budget\s*)?line(\s*(no\.?|number|code|ref|id|#))?$|^code$|^(ref\.?|no\.?|number|#|id)$|^budget\s*code$/i,
  description: /desc|^item|line\s*item|position|activity\s*\/|particular|narrative|^name$/i,
  category: /categor|group|section|heading|cost\s*type|^type$/i,
  amount: /^total|amount|budget(ed)?\b|value|approved/i,
}

export function guessMapping(header: Cell[]): Mapping {
  const m = emptyMapping()
  const h = header.map((c) => str(c))
  const used = new Set<number>()
  const pick = (key: MapKey, re: RegExp, extra?: (t: string) => boolean) => {
    const idx = h.findIndex((t, i) => t && !used.has(i) && re.test(t) && (!extra || extra(t)))
    if (idx >= 0) { m[key] = idx; used.add(idx) }
  }
  pick('unitCost', GUESS.unitCost)
  pick('quantity', GUESS.quantity)
  pick('frequency', GUESS.frequency)
  pick('pct', GUESS.pct)
  pick('activityCode', GUESS.activityCode)
  pick('accountNo', GUESS.accountNo)
  pick('location', GUESS.location)
  pick('unit', GUESS.unit)
  pick('code', GUESS.code)
  pick('description', GUESS.description)
  pick('category', GUESS.category)
  // amount: prefer a plain "Total (CUR)" / "Total in USD" column; take the right-most total-like column that is not a sub-component
  const totals = h.map((t, i) => (!used.has(i) && GUESS.amount.test(t) && !/unit|euro|eur\b|%|narrativ|note|verif|comment|actual|remain|forecast|forcast|commit/i.test(t) ? i : -1)).filter((i) => i >= 0)
  if (totals.length) { m.amount = totals[totals.length - 1]!; used.add(m.amount) }
  if (m.description < 0) { const first = h.findIndex((t, i) => t && !used.has(i)); if (first >= 0) m.description = first }
  return m
}

export function currencyFromHeader(header: Cell[], amountIdx: number): Currency | undefined {
  const t = str(header[amountIdx] ?? '')
  const mm = /\b(USD|JOD|EUR)\b/i.exec(t); return mm ? (mm[1]!.toUpperCase() as Currency) : undefined
}

export function extractLines(rows: Cell[][], headerRow: number, m: Mapping, warnings?: string[]): BudgetLine[] {
  const out: BudgetLine[] = []
  let section: string | undefined
  let sectionSum = 0
  const numericCols = [m.amount, m.quantity, m.unitCost, m.frequency].filter((i) => i >= 0)
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i]!
    const desc = m.description >= 0 ? str(r[m.description]) : ''
    const code = m.code >= 0 ? str(r[m.code]) : ''
    const first = str(r.find((c) => c != null && c !== '') ?? '')
    const noNumbers = numericCols.every((c) => r[c] == null || r[c] === '')
    if (isGrandTotal(first) || isGrandTotal(desc)) break
    if (isSubtotal(first) || isSubtotal(desc) || isSubtotal(code)) {
      const sheetTotal = m.amount >= 0 ? num(r[m.amount]) : 0
      if (warnings && sheetTotal && Math.abs(sheetTotal - sectionSum) > 0.5) warnings.push(`"${first || desc}" shows ${sheetTotal.toLocaleString()} in the file but its lines add up to ${sectionSum.toLocaleString()} — check unit costs on those lines.`)
      sectionSum = 0; continue
    }
    if (isHeading(r) || (noNumbers && ((code && !desc) || (desc && !code)) && !(m.unit >= 0 && str(r[m.unit])))) { section = first; sectionSum = 0; continue }
    if (!desc && !code) continue
    let amount = m.amount >= 0 ? num(r[m.amount]) : 0
    const units = m.quantity >= 0 ? num(r[m.quantity]) : undefined
    const frequency = m.frequency >= 0 ? num(r[m.frequency]) : undefined
    const unitCost = m.unitCost >= 0 ? num(r[m.unitCost]) : undefined
    const pctRaw = m.pct >= 0 ? num(r[m.pct]) : undefined
    const pct = pctRaw === undefined ? undefined : pctRaw > 1 ? pctRaw / 100 : pctRaw
    if (!amount && unitCost) amount = (units || 1) * (frequency || 1) * unitCost * (pct ?? 1)
    const unbudgeted = /^unb/i.test(code) || /unbudget/i.test(section ?? '')
    sectionSum += amount
    out.push({
      id: uid('bl_'), code: code || `L${out.length + 1}`, description: desc || code, amount, category: m.category >= 0 ? str(r[m.category]) || section : section,
      location: m.location >= 0 ? str(r[m.location]) || undefined : undefined, unit: m.unit >= 0 ? str(r[m.unit]) || undefined : undefined,
      units, frequency, unitCost, pct, activityCode: m.activityCode >= 0 ? str(r[m.activityCode]) || undefined : undefined, accountNo: m.accountNo >= 0 ? str(r[m.accountNo]) || undefined : undefined,
      costType: unbudgeted ? 'unbudgeted' : undefined,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Budget vs Actual — columns follow the RHS BvA sheet (Annex 1):
//   Total Amount · Actual · Remaining · Burn Rate · Forecast · Commitments ·
//   Actual with Commitments and Forecast · Remaining with … · Burn Rate with …
// ---------------------------------------------------------------------------
export interface BvARow {
  line?: BudgetLine
  code: string
  description: string
  section: string
  budget: number        // M  Total Amount
  actual: number        // N  paid invoices
  forecast: number      // Q  requisitions in approval / sourcing (pipeline)
  commitments: number   // R  approved / issued POs not yet paid
  remaining: number     // O  = M − N
  burnPct: number       // P  = N / M
  withCommit: number    // S  = N + Q + R
  remainingWithCommit: number  // T = M − S
  burnWithCommitPct: number    // U = S / M
}

const OPEN_PR: PurchaseRequisition['status'][] = ['pending_approval', 'approved', 'sourcing', 'awarded']
const OPEN_PO: PurchaseOrder['status'][] = ['approved', 'issued', 'contracted', 'partially_received', 'received', 'closed']
const matchCode = (lineCode: string, code: string) => lineCode === code || lineCode.startsWith(code + ' ')
const mk = (code: string, description: string, section: string, budget: number, actual: number, forecast: number, commitments: number, line?: BudgetLine): BvARow => {
  const withCommit = actual + forecast + commitments
  return { line, code, description, section, budget, actual, forecast, commitments, remaining: budget - actual, burnPct: budget ? Math.round((actual / budget) * 100) : 0, withCommit, remainingWithCommit: budget - withCommit, burnWithCommitPct: budget ? Math.round((withCommit / budget) * 100) : 0 }
}

export interface BvA { rows: BvARow[]; sections: { name: string; rows: BvARow[]; total: BvARow }[]; unbudgeted: BvARow[]; totals: BvARow; approvedTotal: BvARow; unbudgetedTotal: BvARow }

export function computeBvA(b: ProjectBudget, prs: PurchaseRequisition[], pos: PurchaseOrder[], invoices: Invoice[], trips: TripRequest[] = []): BvA {
  const projectPRs = prs.filter((p) => p.donorCode === b.donorCode)
  const projectPOs = pos.filter((po) => projectPRs.some((p) => p.id === po.prId) && OPEN_PO.includes(po.status))
  const paidInv = invoices.filter((i) => i.status === 'paid' && projectPOs.some((po) => po.id === i.poId))
  const codes = b.lines.map((l) => l.code)
  const bucket = (code: string) => codes.find((c) => matchCode(code, c)) ?? code
  const acc: Record<string, { forecast: number; commitments: number; actual: number }> = {}
  const add = (code: string, k: 'forecast' | 'commitments' | 'actual', v: number) => { const key = bucket(code); (acc[key] ??= { forecast: 0, commitments: 0, actual: 0 })[k] += v }
  for (const p of projectPRs.filter((p) => OPEN_PR.includes(p.status))) for (const l of p.lines) add(l.budgetLine, 'forecast', l.quantity * l.unitPrice)
  for (const po of projectPOs) for (const l of po.lines) add(l.budgetLine, 'commitments', l.quantity * l.unitPrice)
  for (const inv of paidInv) { const po = projectPOs.find((x) => x.id === inv.poId)!; for (const il of inv.lines) { const pl = po.lines.find((x) => x.id === il.lineItemId); if (pl) { add(pl.budgetLine, 'actual', il.quantity * il.unitPrice); add(pl.budgetLine, 'commitments', -(il.quantity * il.unitPrice)) } } }
  // Fleet: closed transport requests charged to this project land as actuals on their budget line
  for (const f of fleetActuals(trips, b.donorCode)) add(f.budgetLine, 'actual', f.amount)
  const get = (c: string) => { const a = acc[c] ?? { forecast: 0, commitments: 0, actual: 0 }; return { ...a, commitments: Math.max(0, a.commitments) } }
  const rows: BvARow[] = b.lines.map((l) => { const a = get(l.code); return mk(l.code, l.description, l.category ?? (l.costType === 'admin' ? 'Admin / Indirect Cost' : 'Direct Cost'), l.amount, a.actual, a.forecast, a.commitments, l) })
  const unbudgeted: BvARow[] = Object.keys(acc).filter((c) => !codes.includes(c)).map((c) => { const a = get(c); return mk(c, 'Not in approved budget', 'Unbudgeted Expenses (not in approved budget)', 0, a.actual, a.forecast, a.commitments) })
  const sum = (rs: BvARow[], code: string, label: string) => mk(code, label, '', rs.reduce((s, r) => s + r.budget, 0), rs.reduce((s, r) => s + r.actual, 0), rs.reduce((s, r) => s + r.forecast, 0), rs.reduce((s, r) => s + r.commitments, 0))
  const sectionNames = [...new Set(rows.map((r) => r.section))]
  const sections = sectionNames.map((name) => { const rs = rows.filter((r) => r.section === name); return { name, rows: rs, total: sum(rs, 'TOTAL', `Total ${name.replace(/^[A-Z]\.\s*/, '')}`) } })
  const budgetedUnb = rows.filter((r) => r.line?.costType === 'unbudgeted')
  const allUnb = [...budgetedUnb, ...unbudgeted]
  return { rows, sections, unbudgeted, totals: sum([...rows, ...unbudgeted], 'GRAND TOTAL', 'Grand Total'), approvedTotal: sum(rows.filter((r) => r.line?.costType !== 'unbudgeted'), 'TOTAL', 'Approved budget lines'), unbudgetedTotal: sum(allUnb, 'TOTAL', 'Total Unbudgeted Expenses') }
}

// ---------------------------------------------------------------------------
// Export in the Annex 1 layout: "Project Budget" · "BvA" · "Expense Allocation"
// ---------------------------------------------------------------------------
const monthsBetween = (start?: string, end?: string, fallback = 12) => {
  const out: string[] = []
  const s = start ? new Date(start) : new Date(); const e = end ? new Date(end) : new Date(s.getFullYear(), s.getMonth() + fallback - 1, 1)
  const d = new Date(s.getFullYear(), s.getMonth(), 1)
  while (d <= e && out.length < 36) { out.push(d.toLocaleString('en', { month: 'short', year: '2-digit' })); d.setMonth(d.getMonth() + 1) }
  return out.length ? out : ['M1']
}
const fmtD = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export function exportBvA(b: ProjectBudget, bva: BvA, prs: PurchaseRequisition[], pos: PurchaseOrder[], invoices: Invoice[], settings: OrgSettings, preparedBy: string) {
  const ccy = b.currency
  const fxUSD = (settings.fxToUSD[ccy] ?? 1), fxEUR = fxUSD / (settings.fxToUSD.EUR ?? 1.08)
  const months = monthsBetween(b.startDate, b.endDate)
  const F = (f: string, v: number) => ({ t: 'n' as const, f, v })
  const wb = XLSX.utils.book_new()

  // ---- Sheet 1: Project Budget (approved budget in Annex layout) ------------
  const pb: unknown[][] = [
    [null, null, null, `${settings.orgName} - Project Budget`],
    ['Project Code', b.donorCode, `Date of Submission: ${fmtD(b.approvedAt)}`, null, null, null, null, null, 'Total Project Budget', bva.approvedTotal.budget, ccy],
    ['Donor', b.donor, `Project Duration ${b.duration ?? ''}`, null, null, null, null, null, 'Remaining Budget', bva.approvedTotal.remainingWithCommit, ccy],
    ['Budget Line', 'Location', 'Description', 'UNIT', '# of Unit', 'Freq', 'curr', 'unit price', 'Covering percentage from this project', 'Total', 'Total in Euro', 'Total in USD', 'Budget Narrative', 'Means of Verification'],
    [],
  ]
  for (const sec of bva.sections) {
    pb.push([sec.name])
    for (const r of sec.rows) { const l = r.line!; pb.push([l.code, l.location ?? '', l.description, l.unit ?? '', l.units ?? '', l.frequency ?? '', ccy, l.unitCost ?? '', l.pct ?? '', l.amount, l.amount * fxEUR, l.amount * fxUSD, '', '']) }
    pb.push([sec.total.description, null, null, null, null, null, null, null, null, sec.total.budget, sec.total.budget * fxEUR, sec.total.budget * fxUSD])
  }
  pb.push(['Grand Total', null, null, null, null, null, null, null, null, bva.approvedTotal.budget, bva.approvedTotal.budget * fxEUR, bva.approvedTotal.budget * fxUSD])
  const ws1 = XLSX.utils.aoa_to_sheet(pb as (string | number | null)[][])
  ws1['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 42 }, { wch: 8 }, { wch: 9 }, { wch: 6 }, { wch: 6 }, { wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Project Budget')

  // ---- Sheet 2: BvA (Annex "Sheet1" layout, columns A–U + monthly forecast) --
  const head = ['Budget Line', 'Location', 'Description', 'UNIT', '# of Unit', 'Freq', 'curr', 'unit price', 'Covering percentage from this project', 'Total', 'Total in Euro', 'Total in USD', 'Total Amount', 'Actual', 'Remaining', 'Burn Rate', 'Forcast', 'Commitments', 'Actual with Commitments and Forcast', 'Remaining with commitments and Forcast', 'Burn Rate with Commitments and Forcast']
  const aoa: unknown[][] = [
    [null, null, null, `${settings.orgName} - Project Budget`],
    ['Project Code', b.donorCode, `Report date: ${fmtD(new Date().toISOString())}`, null, null, null, null, null, 'Total Project Budget', bva.approvedTotal.budget, ccy],
    ['Donor', b.donor, `Project Duration ${b.duration ?? ''}`, null, null, null, null, null, 'Remaining Budget', bva.totals.remainingWithCommit, ccy],
    [...head, ...months],
    [null, null, 'Forecast by month →', ...Array(18).fill(null), ...months],
  ]
  const rowIdx: Record<string, number> = {}
  const lineRow = (r: BvARow, excelRow: number, isTotal = false) => {
    const l = r.line
    const M = `M${excelRow}`, N = `N${excelRow}`, Q = `Q${excelRow}`, R = `R${excelRow}`, S = `S${excelRow}`
    const first = months.length ? XLSX.utils.encode_col(21) : 'V', last = XLSX.utils.encode_col(21 + Math.max(months.length - 1, 0))
    return [
      isTotal ? r.description : r.code, l?.location ?? '', isTotal ? '' : r.description, l?.unit ?? '', l?.units ?? '', l?.frequency ?? '', isTotal ? '' : ccy, l?.unitCost ?? '', l?.pct ?? '',
      r.budget, F(`J${excelRow}*${fxEUR.toFixed(4)}`, r.budget * fxEUR), F(`J${excelRow}*${fxUSD.toFixed(4)}`, r.budget * fxUSD),
      F(`J${excelRow}`, r.budget), r.actual, F(`${M}-${N}`, r.remaining), r.budget ? F(`${N}/${M}`, r.actual / r.budget) : l ? '' : 'Unbudgeted',
      F(`SUM(${first}${excelRow}:${last}${excelRow})+${r.forecast}`, r.forecast), r.commitments, F(`${N}+${Q}+${R}`, r.withCommit), F(`${M}-${S}`, r.remainingWithCommit), r.budget ? F(`${S}/${M}`, r.withCommit / r.budget) : l ? '' : 'Unbudgeted',
    ]
  }
  const totalRow = (label: string, rs: BvARow[], t: BvARow, excelRow: number) => {
    const refs = rs.map((r) => rowIdx[r.code + '|' + r.section]).filter(Boolean)
    const sumOf = (col: string) => (refs.length ? `SUM(${refs.map((i) => `${col}${i}`).join(',')})` : '0')
    const M = `M${excelRow}`, N = `N${excelRow}`, Q = `Q${excelRow}`, R = `R${excelRow}`, S = `S${excelRow}`
    return [label, null, null, null, null, null, null, null, null, F(sumOf('J'), t.budget), F(sumOf('K'), t.budget * fxEUR), F(sumOf('L'), t.budget * fxUSD), F(sumOf('M'), t.budget), F(sumOf('N'), t.actual), F(`${M}-${N}`, t.remaining), t.budget ? F(`${N}/${M}`, t.actual / t.budget) : 'Unbudgeted', F(sumOf('Q'), t.forecast), F(sumOf('R'), t.commitments), F(`${N}+${Q}+${R}`, t.withCommit), F(`${M}-${S}`, t.remainingWithCommit), t.budget ? F(`${S}/${M}`, t.withCommit / t.budget) : 'Unbudgeted']
  }
  const sectionTotalRows: number[] = []
  for (const sec of bva.sections) {
    aoa.push([sec.name])
    for (const r of sec.rows) { const i = aoa.length + 1; rowIdx[r.code + '|' + r.section] = i; aoa.push(lineRow(r, i)) }
    const ti = aoa.length + 1; sectionTotalRows.push(ti); aoa.push(totalRow(sec.total.description, sec.rows, sec.total, ti))
  }
  if (bva.unbudgeted.length) {
    aoa.push(['Unbudgeted Expenses (not in approved budget)'])
    for (const r of bva.unbudgeted) { const i = aoa.length + 1; rowIdx[r.code + '|' + r.section] = i; aoa.push(lineRow(r, i)) }
    const ti = aoa.length + 1; sectionTotalRows.push(ti); aoa.push(totalRow('Total Unbudgeted Expenses', bva.unbudgeted, bva.unbudgetedTotal, ti))
  }
  const gi = aoa.length + 1
  const g = (col: string) => F(`SUM(${sectionTotalRows.map((i) => `${col}${i}`).join(',')})`, 0)
  const T = bva.totals
  aoa.push(['Grand Total', null, null, null, null, null, null, null, null, { ...g('J'), v: T.budget }, { ...g('K'), v: T.budget * fxEUR }, { ...g('L'), v: T.budget * fxUSD }, { ...g('M'), v: T.budget }, { ...g('N'), v: T.actual }, F(`M${gi}-N${gi}`, T.remaining), F(`N${gi}/M${gi}`, T.budget ? T.actual / T.budget : 0), { ...g('Q'), v: T.forecast }, { ...g('R'), v: T.commitments }, F(`N${gi}+Q${gi}+R${gi}`, T.withCommit), F(`M${gi}-S${gi}`, T.remainingWithCommit), F(`S${gi}/M${gi}`, T.budget ? T.withCommit / T.budget : 0)])
  // Financial summary (as in the template)
  const received = b.fundsReceived ?? 0
  const A = bva.approvedTotal, U = bva.unbudgetedTotal
  aoa.push([], [null, null, 'Financial Summary', null, null, null, null, null, null, ccy, null, 'USD'])
  const fs = (label: string, v: number) => [null, null, label, null, null, null, null, null, null, v, null, v * fxUSD]
  aoa.push(fs(`Donation received from ${b.donor || 'donor'}`, received), fs('Approved budget', A.budget), fs('Spent on approved budget lines', A.actual), fs('Spent on unbudgeted lines', U.actual), fs('Total spent', T.actual), fs('Remaining approved budget (after all spending)', A.budget - T.actual), fs('Cash balance (donation received – total spent)', received - T.actual), [null, null, 'Overall burn rate vs approved budget', null, null, null, null, null, null, A.budget ? T.actual / A.budget : 0])
  aoa.push([], [null, null, `Prepared by ${preparedBy} · Document owner ${b.ownerName} · ${settings.orgName}`])
  const ws2 = XLSX.utils.aoa_to_sheet(aoa as (string | number | null)[][])
  ws2['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 8 }, { wch: 9 }, { wch: 6 }, { wch: 6 }, { wch: 11 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 9 }, { wch: 11 }, { wch: 13 }, { wch: 15 }, { wch: 15 }, { wch: 11 }, ...months.map(() => ({ wch: 8 }))]
  ws2['!freeze'] = { xSplit: 3, ySplit: 5 }
  XLSX.utils.book_append_sheet(wb, ws2, 'BvA')

  // ---- Sheet 3: Expense Allocation (paid invoices) + Sheet 4: Commitments ----
  const projectPRs = prs.filter((p) => p.donorCode === b.donorCode)
  const projectPOs = pos.filter((po) => projectPRs.some((p) => p.id === po.prId))
  const paid = invoices.filter((i) => i.status === 'paid' && projectPOs.some((po) => po.id === i.poId))
  const ea: unknown[][] = [
    [`Expense Allocation – ${b.donorCode} ${b.name}`], [`Period ${fmtD(b.startDate)} – ${fmtD(b.endDate)} · amounts in ${ccy} · source: paid invoices in the Procurement Suite`],
    [`${ccy} → USD rate`, fxUSD, null, 'Total expenses', T.actual], ['Total per Trial Balance', null, null, 'Allocated to budget lines', T.actual], [null, null, null, 'Unallocated', 0], [],
    ['Account Code', 'Account Name', 'Date', 'Description', `Amount (${ccy})`, 'Budget Line 1', '% Line 1', 'Budget Line 2', '% Line 2', `Line 1 Amount (${ccy})`, `Line 2 Amount (${ccy})`, 'Allocation Note'],
  ]
  for (const inv of paid) { const po = projectPOs.find((x) => x.id === inv.poId)!; for (const il of inv.lines) { const pl = po.lines.find((x) => x.id === il.lineItemId); if (!pl) continue; const amt = il.quantity * il.unitPrice; ea.push([pl.costCenter.split(' ')[0], pl.category, fmtD(inv.payment?.paidAt), `${inv.number} · ${inv.vendorInvoiceNo} · ${inv.vendorName} · ${po.number} · ${il.description}`, amt, pl.budgetLine, 1, '', 0, amt, 0, codes_has(b, pl.budgetLine) ? '' : 'Unbudgeted – not in approved budget']) } }
  const ws3 = XLSX.utils.aoa_to_sheet(ea as (string | number | null)[][]); ws3['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 60 }, { wch: 13 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Expense Allocation')
  const cm: unknown[][] = [[`Commitments – open purchase orders charged to ${b.donorCode}`], [], ['PO', 'Vendor', 'Status', 'Line', 'Budget Line', `Ordered (${ccy})`, `Paid (${ccy})`, `Open commitment (${ccy})`]]
  for (const po of projectPOs.filter((p) => OPEN_PO.includes(p.status))) for (const l of po.lines) { const paidAmt = paid.filter((i) => i.poId === po.id).reduce((s, i) => s + (i.lines.find((x) => x.lineItemId === l.id)?.quantity ?? 0) * (i.lines.find((x) => x.lineItemId === l.id)?.unitPrice ?? 0), 0); cm.push([po.number, po.vendorName, po.status, l.description, l.budgetLine, l.quantity * l.unitPrice, paidAmt, Math.max(0, l.quantity * l.unitPrice - paidAmt)]) }
  const ws4 = XLSX.utils.aoa_to_sheet(cm as (string | number | null)[][]); ws4['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws4, 'Commitments')

  XLSX.writeFile(wb, `BvA-${b.donorCode}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
const codes_has = (b: ProjectBudget, code: string) => b.lines.some((l) => matchCode(code, l.code))
