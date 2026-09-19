import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Upload, Save, Plus, Trash2 } from 'lucide-react'
import { useStore, useCurrentUser, attachmentFromFile } from '@/store/useStore'
import { Card, PageHeader, Field, Alert } from '@/components/ui'
import { readWorkbook, detectHeaderRow, guessMapping, extractLines, sheetScore, type ParsedSheet, type Mapping, type MapKey } from '@/lib/budget'
import { fmtMoney, uid, nowIso, toInputDate } from '@/lib/format'
import { DOC_OWNER } from '@/data/seed'
import type { Attachment, BudgetLine, Currency, ProjectBudget } from '@/types'

const MAP_LABEL: Record<MapKey, string> = { code: 'Line code', description: 'Description', category: 'Category', amount: 'Approved amount', quantity: 'Quantity (optional)', unitCost: 'Unit cost (optional)' }

export default function BudgetUpload() {
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { upsertBudget, budgets, settings } = useStore()
  const [meta, setMeta] = useState({ donorCode: '', name: '', donor: '', currency: settings.defaultCurrency as Currency, startDate: '', endDate: '', approvedAt: toInputDate(new Date()), notes: '' })
  const [file, setFile] = useState<Attachment | null>(null)
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [sheetIdx, setSheetIdx] = useState(0)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<Mapping>({ code: -1, description: -1, category: -1, amount: -1, quantity: -1, unitCost: -1 })
  const [lines, setLines] = useState<BudgetLine[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const sheet = sheets[sheetIdx]
  const header = sheet?.rows[headerRow] ?? []
  const preview = useMemo(() => (sheet ? extractLines(sheet.rows, headerRow, mapping) : []), [sheet, headerRow, mapping])
  const total = (lines ?? preview).reduce((s, l) => s + l.amount, 0)

  const onFile = async (f: File) => {
    setErr(null)
    try {
      const buf = await f.arrayBuffer()
      const parsed = readWorkbook(buf)
      if (!parsed.length) return setErr('No sheets found in the file.')
      setFile(await attachmentFromFile(f, user.name)); setSheets(parsed); pickSheet(parsed, parsed.map((sh, i) => [sheetScore(sh.rows), i] as const).sort((a, b) => b[0] - a[0])[0]![1])
      if (!meta.name) setMeta((m) => ({ ...m, name: f.name.replace(/\.(xlsx|xls|csv)$/i, '') }))
    } catch (e) { setErr(`Could not read the file: ${(e as Error).message}`) }
  }
  const pickSheet = (all: ParsedSheet[], i: number) => { const h = detectHeaderRow(all[i]!.rows); setSheetIdx(i); setHeaderRow(h); setMapping(guessMapping(all[i]!.rows[h] ?? [])); setLines(null) }
  const setHeader = (h: number) => { setHeaderRow(h); setMapping(guessMapping(sheet?.rows[h] ?? [])); setLines(null) }
  const save = () => {
    const ls = lines ?? preview
    if (!meta.donorCode.trim()) return setErr('Project / donor code is required — requesters pick it on the requisition.')
    if (budgets.some((b) => b.donorCode.toLowerCase() === meta.donorCode.trim().toLowerCase())) return setErr('A budget with this project code already exists. Remove it first or use a new code.')
    if (!meta.name.trim()) return setErr('Budget name is required.')
    if (!ls.length) return setErr('No budget lines extracted — adjust the header row and column mapping.')
    if (ls.some((l) => !l.code.trim())) return setErr('Every budget line needs a code.')
    const b: ProjectBudget = { id: uid('bud_'), donorCode: meta.donorCode.trim(), name: meta.name.trim(), donor: meta.donor.trim(), currency: meta.currency, startDate: meta.startDate || undefined, endDate: meta.endDate || undefined, approvedAt: meta.approvedAt || undefined, status: 'active', lines: ls, sourceFile: file ?? undefined, sourceSheet: sheet?.name, uploadedBy: user.id, uploadedByName: user.name, uploadedAt: nowIso(), ownerName: DOC_OWNER, notes: meta.notes }
    upsertBudget(b); nav(`/budgets/${b.id}`)
  }
  const editLine = (id: string, patch: Partial<BudgetLine>) => setLines((lines ?? preview).map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const shown = lines ?? preview

  return (
    <>
      <PageHeader eyebrow="New document" title="Upload approved budget" subtitle={`Uploaded by ${user.name} · Owner ${DOC_OWNER}`}
        actions={<><button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={save} disabled={!sheet}><Save size={15} /> Save budget ({shown.length} lines)</button></>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="1 · Budget file" description="Excel or CSV. The system finds the header row and maps the columns; you can correct the mapping below.">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-300 px-4 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
              {file ? <><FileSpreadsheet size={26} className="text-brand-600" /><div className="text-[13.5px] font-medium text-ink-900">{file.name}</div><div className="text-[12px] text-ink-500">{sheets.length} sheet(s) · click to replace</div></> : <><Upload size={26} className="text-ink-400" /><div className="text-[13.5px] font-medium text-ink-900">Drop the approved budget here or click to browse</div><div className="text-[12px] text-ink-500">{settings.templates.budget ? `Expected layout: ${settings.templates.budget.name}` : 'Any tabular layout — columns are mapped in the next step'}</div></>}
            </label>
          </Card>

          {sheet && (
            <Card title="2 · Column mapping" description="Confirm which columns hold the line code, description and approved amount.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sheet"><select className="input" value={sheetIdx} onChange={(e) => pickSheet(sheets, Number(e.target.value))}>{sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>)}</select></Field>
                <Field label="Header row" hint={`Detected: row ${headerRow + 1}`}><select className="input" value={headerRow} onChange={(e) => setHeader(Number(e.target.value))}>{sheet.rows.slice(0, 40).map((r, i) => <option key={i} value={i}>Row {i + 1}: {r.filter((c) => c != null && c !== '').slice(0, 4).join(' | ').slice(0, 70)}</option>)}</select></Field>
                {(Object.keys(MAP_LABEL) as MapKey[]).map((k) => (
                  <Field key={k} label={MAP_LABEL[k]} required={k === 'description' || k === 'amount'}><select className="input" value={mapping[k]} onChange={(e) => { setMapping({ ...mapping, [k]: Number(e.target.value) }); setLines(null) }}><option value={-1}>— not in file —</option>{header.map((h, i) => <option key={i} value={i}>{String.fromCharCode(65 + (i % 26))}: {h == null ? '(blank)' : String(h).slice(0, 40)}</option>)}</select></Field>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto scrollbar-thin rounded-control border border-line">
                <table className="w-full text-[12px]"><thead><tr>{header.map((h, i) => <th key={i} className="table-th whitespace-nowrap">{String.fromCharCode(65 + (i % 26))} · {h == null ? '' : String(h).slice(0, 24)}</th>)}</tr></thead>
                  <tbody>{sheet.rows.slice(headerRow + 1, headerRow + 6).map((r, ri) => <tr key={ri}>{header.map((_, ci) => <td key={ci} className="table-td whitespace-nowrap text-ink-600">{r[ci] == null ? '' : String(r[ci]).slice(0, 30)}</td>)}</tr>)}</tbody></table>
              </div>
            </Card>
          )}

          {sheet && (
            <Card title={`3 · Extracted budget lines (${shown.length})`} description="Review and correct before saving. Sub-total and total rows are skipped automatically." padded={false}
              actions={<button className="btn-secondary btn-sm" onClick={() => setLines([...(shown), { id: uid('bl_'), code: '', description: '', amount: 0 }])}><Plus size={13} /> Add line</button>}>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead><tr><th className="table-th w-36">Code</th><th className="table-th">Description</th><th className="table-th w-40">Category</th><th className="table-th w-40 text-right">Approved ({meta.currency})</th><th className="table-th w-10" /></tr></thead>
                  <tbody>{shown.map((l) => (
                    <tr key={l.id}><td className="table-td"><input className="input font-mono" value={l.code} onChange={(e) => editLine(l.id, { code: e.target.value })} /></td>
                      <td className="table-td"><input className="input" value={l.description} onChange={(e) => editLine(l.id, { description: e.target.value })} /></td>
                      <td className="table-td"><input className="input" value={l.category ?? ''} onChange={(e) => editLine(l.id, { category: e.target.value || undefined })} /></td>
                      <td className="table-td"><input type="number" step="0.01" className="input text-right" value={l.amount} onChange={(e) => editLine(l.id, { amount: Number(e.target.value) })} /></td>
                      <td className="table-td"><button className="btn-ghost btn-sm text-accent-700" onClick={() => setLines(shown.filter((x) => x.id !== l.id))}><Trash2 size={13} /></button></td></tr>))}
                    {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-500">Nothing extracted — check the header row and the Description / Amount mapping.</td></tr>}
                  </tbody>
                  <tfoot><tr><td colSpan={3} className="px-4 py-3 text-right text-[12px] uppercase text-ink-500">Total approved</td><td className="px-4 py-3 text-right text-[15px] font-semibold tabular-nums">{fmtMoney(total, meta.currency)}</td><td /></tr></tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Project / grant">
            <div className="space-y-4">
              <Field label="Project / donor code" required hint="Shown to requesters in the requisition dropdown"><input className="input font-mono" value={meta.donorCode} onChange={(e) => setMeta({ ...meta, donorCode: e.target.value })} placeholder="e.g. GR-2026-AMM-01" /></Field>
              <Field label="Budget name" required><input className="input" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
              <Field label="Donor / funding source"><input className="input" value={meta.donor} onChange={(e) => setMeta({ ...meta, donor: e.target.value })} /></Field>
              <Field label="Currency"><select className="input" value={meta.currency} onChange={(e) => setMeta({ ...meta, currency: e.target.value as Currency })}><option>JOD</option><option>USD</option><option>EUR</option></select></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Start"><input type="date" className="input" value={meta.startDate} onChange={(e) => setMeta({ ...meta, startDate: e.target.value })} /></Field><Field label="End"><input type="date" className="input" value={meta.endDate} onChange={(e) => setMeta({ ...meta, endDate: e.target.value })} /></Field></div>
              <Field label="Approved on"><input type="date" className="input" value={meta.approvedAt} onChange={(e) => setMeta({ ...meta, approvedAt: e.target.value })} /></Field>
              <Field label="Notes"><textarea className="input min-h-[64px]" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Approval reference, grant agreement annex…" /></Field>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
