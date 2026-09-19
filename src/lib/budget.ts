// ---------------------------------------------------------------------------
// Approved-budget extraction (Excel) and Budget-vs-Actual computation
// ---------------------------------------------------------------------------
import * as XLSX from 'xlsx'
import type { BudgetLine, Invoice, ProjectBudget, PurchaseOrder, PurchaseRequisition } from '@/types'
import { uid } from './format'

export type Cell = string | number | null
export interface ParsedSheet { name: string; rows: Cell[][] }
export type MapKey = 'code' | 'description' | 'category' | 'amount' | 'quantity' | 'unitCost'
export type Mapping = Record<MapKey, number>   // column index or -1

export function readWorkbook(buf: ArrayBuffer): ParsedSheet[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: false }) as Cell[][]
    return { name, rows: rows.map((r) => r.map((c) => (typeof c === 'string' ? c.trim() : c))) }
  })
}

const HEADER_HINTS = /budget|line|code|description|amount|total|unit|qty|quantity|cost|item|activity|category/i

/** Header row = first row with ≥ 2 text cells where at least one looks like a budget header. */
/** Score how much a sheet looks like a budget table (header-like row found, several numeric rows below it). */
export function sheetScore(rows: Cell[][]): number {
  const h = detectHeaderRow(rows)
  const header = rows[h] ?? []
  const hits = header.filter((c) => typeof c === 'string' && HEADER_HINTS.test(c)).length
  const numericRows = rows.slice(h + 1).filter((r) => r.some((c) => typeof c === 'number')).length
  return hits * 10 + Math.min(numericRows, 20)
}

export function detectHeaderRow(rows: Cell[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const texts = rows[i]!.filter((c) => typeof c === 'string' && c.length > 0) as string[]
    if (texts.length >= 2 && texts.some((t) => HEADER_HINTS.test(t))) return i
  }
  return 0
}

const GUESS: Record<MapKey, RegExp> = {
  code: /^(budget\s*)?line(\s*(no\.?|number|code|ref|id|#))?$|^(code|ref\.?|no\.?|number|#|id)$|line\s*(code|no|number)|budget\s*code|account\s*(code|no)/i,
  description: /desc|item|activity|line\s*item|name|particular|narrative/i,
  category: /categor|group|section|heading|cost\s*type|type/i,
  amount: /total|amount|budget(ed)?\b|value|jod|usd|eur|approved/i,
  quantity: /^qty|quantity|units?$|no\.?\s*of/i,
  unitCost: /unit\s*(cost|price|rate)|rate|price/i,
}

export function guessMapping(header: Cell[]): Mapping {
  const m: Mapping = { code: -1, description: -1, category: -1, amount: -1, quantity: -1, unitCost: -1 }
  const h = header.map((c) => (c == null ? '' : String(c)))
  for (const key of ['code', 'description', 'quantity', 'unitCost', 'category', 'amount'] as MapKey[]) {
    const idx = h.findIndex((t, i) => t && GUESS[key].test(t) && !Object.values(m).includes(i))
    if (idx >= 0) m[key] = idx
  }
  // amount: prefer the right-most "total"-like column when several match
  const totals = h.map((t, i) => (/total|budget/i.test(t) && !/unit/i.test(t) ? i : -1)).filter((i) => i >= 0 && i !== m.code && i !== m.description)
  if (totals.length) m.amount = totals[totals.length - 1]!
  if (m.description < 0) { const first = h.findIndex((t, i) => t && i !== m.code && i !== m.amount); if (first >= 0) m.description = first }
  return m
}

export const num = (c: Cell): number => {
  if (typeof c === 'number') return c
  if (typeof c === 'string') { const n = Number(c.replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
  return 0
}

export function extractLines(rows: Cell[][], headerRow: number, m: Mapping): BudgetLine[] {
  const out: BudgetLine[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i]!
    const desc = m.description >= 0 ? String(r[m.description] ?? '').trim() : ''
    const code = m.code >= 0 ? String(r[m.code] ?? '').trim() : ''
    let amount = m.amount >= 0 ? num(r[m.amount]) : 0
    if (!amount && m.quantity >= 0 && m.unitCost >= 0) amount = num(r[m.quantity]) * num(r[m.unitCost])
    if (!desc && !code) continue
    if (/^(sub[\s-]*)?total|^grand[\s-]*total|^sum\b/i.test(desc) || /^(sub[\s-]*)?total/i.test(code)) continue
    if (!amount && !code) continue   // section headings without a value
    out.push({ id: uid('bl_'), code: code || `L${out.length + 1}`, description: desc || code, category: m.category >= 0 ? String(r[m.category] ?? '').trim() || undefined : undefined, amount })
  }
  return out
}

// ---------------------------------------------------------------------------
// Budget vs Actual
// ---------------------------------------------------------------------------
export interface BvARow {
  line?: BudgetLine
  code: string
  description: string
  budget: number
  requested: number     // PRs in approval / sourcing (not yet ordered)
  committed: number     // open POs not yet paid
  actual: number        // paid invoices
  available: number
  burnPct: number
}

const OPEN_PR: PurchaseRequisition['status'][] = ['pending_approval', 'approved', 'sourcing', 'awarded']
const OPEN_PO: PurchaseOrder['status'][] = ['approved', 'issued', 'contracted', 'partially_received', 'received', 'closed']

const matchCode = (lineCode: string, code: string) => lineCode === code || lineCode.startsWith(code + ' ')

export function computeBvA(b: ProjectBudget, prs: PurchaseRequisition[], pos: PurchaseOrder[], invoices: Invoice[]): { rows: BvARow[]; totals: BvARow } {
  const projectPRs = prs.filter((p) => p.donorCode === b.donorCode)
  const projectPOs = pos.filter((po) => projectPRs.some((p) => p.id === po.prId) && OPEN_PO.includes(po.status))
  const paidInv = invoices.filter((i) => i.status === 'paid' && projectPOs.some((po) => po.id === i.poId))
  const codes = new Set<string>(b.lines.map((l) => l.code))
  const bucket = (code: string) => [...codes].find((c) => matchCode(code, c)) ?? code
  const acc: Record<string, { requested: number; committed: number; actual: number }> = {}
  const add = (code: string, k: 'requested' | 'committed' | 'actual', v: number) => { const key = bucket(code); (acc[key] ??= { requested: 0, committed: 0, actual: 0 })[k] += v }
  for (const p of projectPRs.filter((p) => OPEN_PR.includes(p.status))) for (const l of p.lines) add(l.budgetLine, 'requested', l.quantity * l.unitPrice)
  for (const po of projectPOs) for (const l of po.lines) add(l.budgetLine, 'committed', l.quantity * l.unitPrice)
  for (const inv of paidInv) { const po = projectPOs.find((x) => x.id === inv.poId)!; for (const il of inv.lines) { const pl = po.lines.find((x) => x.id === il.lineItemId); if (pl) { add(pl.budgetLine, 'actual', il.quantity * il.unitPrice); add(pl.budgetLine, 'committed', -(il.quantity * il.unitPrice)) } } }
  const rows: BvARow[] = b.lines.map((l) => { const a = acc[l.code] ?? { requested: 0, committed: 0, actual: 0 }; const committed = Math.max(0, a.committed); const available = l.amount - committed - a.actual; return { line: l, code: l.code, description: l.description, budget: l.amount, requested: a.requested, committed, actual: a.actual, available, burnPct: l.amount ? Math.round(((committed + a.actual) / l.amount) * 100) : 0 } })
  for (const code of Object.keys(acc).filter((c) => !codes.has(c))) { const a = acc[code]!; rows.push({ code, description: 'Not in approved budget', budget: 0, requested: a.requested, committed: Math.max(0, a.committed), actual: a.actual, available: -(Math.max(0, a.committed) + a.actual), burnPct: 0 }) }
  const sum = (k: keyof BvARow) => rows.reduce((s, r) => s + (r[k] as number), 0)
  const totals: BvARow = { code: 'TOTAL', description: '', budget: sum('budget'), requested: sum('requested'), committed: sum('committed'), actual: sum('actual'), available: sum('available'), burnPct: sum('budget') ? Math.round(((sum('committed') + sum('actual')) / sum('budget')) * 100) : 0 }
  return { rows, totals }
}

export function exportBvA(b: ProjectBudget, rows: BvARow[], totals: BvARow, orgName: string, preparedBy: string) {
  const aoa: (string | number)[][] = [
    [`${orgName} — Budget vs Actual`], [`Project / grant: ${b.donorCode} — ${b.name}`], [`Donor: ${b.donor} · Currency: ${b.currency} · Period: ${b.startDate ?? ''} – ${b.endDate ?? ''}`], [`Prepared by ${preparedBy} on ${new Date().toISOString().slice(0, 10)} · Document owner: ${b.ownerName}`], [],
    ['Line code', 'Description', 'Category', 'Approved budget', 'Requested (PRs)', 'Committed (POs)', 'Actual (paid)', 'Committed + Actual', 'Available', 'Burn %'],
    ...rows.map((r) => [r.code, r.description, r.line?.category ?? '', r.budget, r.requested, r.committed, r.actual, r.committed + r.actual, r.available, r.burnPct / 100]),
    ['TOTAL', '', '', totals.budget, totals.requested, totals.committed, totals.actual, totals.committed + totals.actual, totals.available, totals.burnPct / 100],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 12 }, { wch: 44 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 8 }]
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'BvA')
  const ws2 = XLSX.utils.aoa_to_sheet([['Line code', 'Description', 'Category', 'Approved budget'], ...b.lines.map((l) => [l.code, l.description, l.category ?? '', l.amount])])
  XLSX.utils.book_append_sheet(wb, ws2, 'Approved budget')
  XLSX.writeFile(wb, `BvA-${b.donorCode}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
