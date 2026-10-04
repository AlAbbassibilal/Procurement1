import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Upload, Save, Plus, Trash2, Sparkles } from 'lucide-react'
import { useStore, useCurrentUser, attachmentFromFile } from '@/store/useStore'
import { Card, PageHeader, Field, Alert } from '@/components/ui'
import { readWorkbook, detectHeaderRow, guessMapping, extractLines, sheetScore, detectMeta, isRhsTemplate, extractRhsTemplate, currencyFromHeader, emptyMapping, MAP_KEYS, type ParsedSheet, type Mapping, type MapKey } from '@/lib/budget'
import { fmtMoney, uid, nowIso, toInputDate } from '@/lib/format'
import { DOC_OWNER } from '@/data/seed'
import type { Attachment, BudgetLine, Currency, ProjectBudget } from '@/types'

const MAP_LABEL: Record<MapKey, string> = { code: 'Line code', description: 'Description', amount: 'Approved total', category: 'Section / category', location: 'Location', unit: 'Unit', quantity: '# of units', frequency: 'Frequency', unitCost: 'Unit cost', pct: 'LoE / % allocated', activityCode: 'Activity code', accountNo: 'Account no.' }
const colLetter = (i: number) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + (i % 26))

export default function BudgetUpload() {
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { upsertBudget, budgets, settings } = useStore()
  const [meta, setMeta] = useState({ donorCode: '', name: '', donor: '', currency: settings.defaultCurrency as Currency, startDate: '', endDate: '', approvedAt: toInputDate(new Date()), duration: '', locations: '', notes: '' })
  const [file, setFile] = useState<Attachment | null>(null)
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [mode, setMode] = useState<'rhs' | 'generic'>('generic')
  const [sheetIdx, setSheetIdx] = useState(0)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<Mapping>(emptyMapping())
  const [lines, setLines] = useState<BudgetLine[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const sheet = sheets[sheetIdx]
  const header = sheet?.rows[headerRow] ?? []
  const { preview, warnings } = useMemo(() => { const warnings: string[] = []; const preview = mode === 'rhs' ? extractRhsTemplate(sheets, warnings) : sheet ? extractLines(sheet.rows, headerRow, mapping, warnings) : []; return { preview, warnings } }, [mode, sheets, sheet, headerRow, mapping])
  const shown = lines ?? preview
  const total = shown.reduce((s, l) => s + l.amount, 0)

  const onFile = async (f: File) => {
    setErr(null)
    try {
      const buf = await f.arrayBuffer()
      const parsed = readWorkbook(buf)
      if (!parsed.length) return setErr('No sheets found in the file.')
      setFile(await attachmentFromFile(f, user.name)); setSheets(parsed); setLines(null)
      const m = detectMeta(parsed)
      const rhs = isRhsTemplate(parsed)
      setMode(rhs ? 'rhs' : 'generic')
      const best = parsed.map((sh, i) => [sheetScore(sh.rows), i] as const).sort((a, b) => b[0] - a[0])[0]![1]
      const h = detectHeaderRow(parsed[best]!.rows); const map = guessMapping(parsed[best]!.rows[h] ?? [])
      setSheetIdx(best); setHeaderRow(h); setMapping(map)
      const cur = m.currency ?? (map.amount >= 0 ? currencyFromHeader(parsed[best]!.rows[h] ?? [], map.amount) : undefined)
      setMeta((x) => ({ ...x, donorCode: x.donorCode || m.donorCode || '', name: x.name || m.name || f.name.replace(/\.(xlsx|xls|csv)$/i, ''), donor: x.donor || m.donor || '', currency: cur ?? x.currency, duration: x.duration || m.duration || '', locations: x.locations || m.locations || '' }))
    } catch (e) { setErr(`Could not read the file: ${(e as Error).message}`) }
  }
  const pickSheet = (i: number) => { const h = detectHeaderRow(sheets[i]!.rows); setSheetIdx(i); setHeaderRow(h); setMapping(guessMapping(sheets[i]!.rows[h] ?? [])); setLines(null) }
  const setHeader = (h: number) => { setHeaderRow(h); setMapping(guessMapping(sheet?.rows[h] ?? [])); setLines(null) }
  const save = () => {
    if (!meta.donorCode.trim()) return setErr('Project / donor code is required — requesters pick it on the requisition.')
    if (budgets.some((b) => b.donorCode.toLowerCase() === meta.donorCode.trim().toLowerCase())) return setErr('A budget with this project code already exists. Remove it first or use a new code.')
    if (!meta.name.trim()) return setErr('Budget name is required.')
    if (!shown.length) return setErr('No budget lines extracted — adjust the header row and column mapping.')
    if (shown.some((l) => !l.code.trim())) return setErr('Every budget line needs a code.')
    const b: ProjectBudget = { id: uid('bud_'), donorCode: meta.donorCode.trim(), name: meta.name.trim(), donor: meta.donor.trim(), currency: meta.currency, startDate: meta.startDate || undefined, endDate: meta.endDate || undefined, approvedAt: meta.approvedAt || undefined, duration: meta.duration || undefined, locations: meta.locations || undefined, status: 'active', lines: shown, sourceFile: file ?? undefined, sourceSheet: mode === 'rhs' ? 'Direct Cost + Admin Cost' : sheet?.name, uploadedBy: user.id, uploadedByName: user.name, uploadedAt: nowIso(), ownerName: DOC_OWNER, notes: meta.notes }
    upsertBudget(b); nav(`/budgets/${b.id}`)
  }
  const editLine = (id: string, patch: Partial<BudgetLine>) => setLines(shown.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const direct = shown.filter((l) => l.costType === 'direct').reduce((s, l) => s + l.amount, 0), admin = shown.filter((l) => l.costType === 'admin').reduce((s, l) => s + l.amount, 0)

  return (
    <>
      <PageHeader eyebrow="New document" title="Upload approved budget" subtitle={`Uploaded by ${user.name} · Owner ${DOC_OWNER}`}
        actions={<><button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={save} disabled={!sheets.length}><Save size={15} /> Save budget ({shown.length} lines)</button></>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="1 · Budget file" description="Excel or CSV. The RHS Project Budget Template and the Annex 1 donor budget are recognised automatically; any other layout can be mapped by column.">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-300 px-4 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
              {file ? <><FileSpreadsheet size={26} className="text-brand-600" /><div className="text-[13.5px] font-medium text-ink-900">{file.name}</div><div className="text-[12px] text-ink-500">{sheets.length} sheet(s) · click to replace</div></> : <><Upload size={26} className="text-ink-400" /><div className="text-[13.5px] font-medium text-ink-900">Drop the approved budget here or click to browse</div><div className="text-[12px] text-ink-500">{settings.templates.budget ? `Organisation template: ${settings.templates.budget.name}` : 'Any tabular layout — columns are mapped in the next step'}</div></>}
            </label>
            {sheets.length > 0 && mode === 'rhs' && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">
                <span className="flex items-center gap-2"><Sparkles size={15} /> <b>RHS Project Budget Template detected</b> — Direct Cost and Admin Cost lines extracted with activity code, account, location and unit detail.</span>
                <button className="btn-ghost btn-sm" onClick={() => { setMode('generic'); setLines(null) }}>Map columns manually instead</button>
              </div>
            )}
          </Card>

          {sheets.length > 0 && mode === 'generic' && (
            <Card title="2 · Column mapping" description="Confirm which columns hold the line code, description and approved total. Section headings and sub-total rows are detected automatically.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sheet"><select className="input" value={sheetIdx} onChange={(e) => pickSheet(Number(e.target.value))}>{sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>)}</select></Field>
                <Field label="Header row" hint={`Detected: row ${headerRow + 1}`}><select className="input" value={headerRow} onChange={(e) => setHeader(Number(e.target.value))}>{sheet!.rows.slice(0, 40).map((r, i) => <option key={i} value={i}>Row {i + 1}: {r.filter((c) => c != null && c !== '').slice(0, 4).join(' | ').slice(0, 70)}</option>)}</select></Field>
                {MAP_KEYS.map((k) => (
                  <Field key={k} label={MAP_LABEL[k]} required={k === 'description' || k === 'amount'}><select className="input" value={mapping[k]} onChange={(e) => { setMapping({ ...mapping, [k]: Number(e.target.value) }); setLines(null) }}><option value={-1}>— not in file —</option>{header.map((h, i) => <option key={i} value={i}>{colLetter(i)}: {h == null ? '(blank)' : String(h).slice(0, 40)}</option>)}</select></Field>
                ))}
                {isRhsTemplate(sheets) && <div className="sm:col-span-2"><button className="btn-secondary btn-sm" onClick={() => { setMode('rhs'); setLines(null) }}><Sparkles size={13} /> Use the RHS template reader</button></div>}
              </div>
              <div className="mt-4 overflow-x-auto scrollbar-thin rounded-control border border-line">
                <table className="w-full text-[12px]"><thead><tr>{header.map((h, i) => <th key={i} className="table-th whitespace-nowrap">{colLetter(i)} · {h == null ? '' : String(h).slice(0, 24)}</th>)}</tr></thead>
                  <tbody>{sheet!.rows.slice(headerRow + 1, headerRow + 6).map((r, ri) => <tr key={ri}>{header.map((_, ci) => <td key={ci} className="table-td whitespace-nowrap text-ink-600">{r[ci] == null ? '' : String(r[ci]).slice(0, 30)}</td>)}</tr>)}</tbody></table>
              </div>
            </Card>
          )}

          {warnings.length > 0 && <Alert tone="warning"><b>Check these before saving:</b><ul className="mt-1 list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></Alert>}
          {sheets.length > 0 && (
            <Card title={`${mode === 'rhs' ? '2' : '3'} · Extracted budget lines (${shown.length})`} description="Review and correct before saving. Sub-total and total rows are skipped; section headings become the category." padded={false}
              actions={<button className="btn-secondary btn-sm" onClick={() => setLines([...shown, { id: uid('bl_'), code: '', description: '', amount: 0 }])}><Plus size={13} /> Add line</button>}>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[1040px] text-[13px]">
                  <thead><tr><th className="table-th w-28">Code</th><th className="table-th">Description</th><th className="table-th w-44">Section</th><th className="table-th w-24">Location</th><th className="table-th w-20">Acct</th><th className="table-th w-36">Basis</th><th className="table-th w-36 text-right">Approved ({meta.currency})</th><th className="table-th w-10" /></tr></thead>
                  <tbody>{shown.map((l) => (
                    <tr key={l.id} className={l.costType === 'admin' ? 'bg-surface-muted/60' : undefined}><td className="table-td"><input className="input font-mono" value={l.code} onChange={(e) => editLine(l.id, { code: e.target.value })} /></td>
                      <td className="table-td"><input className="input" value={l.description} onChange={(e) => editLine(l.id, { description: e.target.value })} />{l.activityCode && <div className="mt-0.5 text-[11px] text-ink-500">Activity {l.activityCode}{l.costType && ` · ${l.costType}`}</div>}</td>
                      <td className="table-td"><input className="input" value={l.category ?? ''} onChange={(e) => editLine(l.id, { category: e.target.value || undefined })} /></td>
                      <td className="table-td text-ink-600">{l.location ?? ''}</td><td className="table-td font-mono text-[12px] text-ink-600">{l.accountNo ?? ''}</td>
                      <td className="table-td text-[12px] text-ink-500">{l.unitCost != null ? `${l.units ?? 1} ${l.unit ?? ''} × ${l.frequency ?? 1} × ${l.unitCost.toLocaleString()}${l.pct != null && l.pct !== 1 ? ` × ${Math.round(l.pct * 100)}%` : ''}` : '—'}</td>
                      <td className="table-td"><input type="number" step="0.01" className="input text-right" value={l.amount} onChange={(e) => editLine(l.id, { amount: Number(e.target.value) })} /></td>
                      <td className="table-td"><button className="btn-ghost btn-sm text-accent-700" onClick={() => setLines(shown.filter((x) => x.id !== l.id))}><Trash2 size={13} /></button></td></tr>))}
                    {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-ink-500">Nothing extracted — check the header row and the Description / Approved total mapping.</td></tr>}
                  </tbody>
                  <tfoot>
                    {mode === 'rhs' && <tr><td colSpan={6} className="px-4 py-1.5 text-right text-[12px] text-ink-500">Direct cost {fmtMoney(direct, meta.currency)} · Admin / indirect {fmtMoney(admin, meta.currency)}{direct ? ` (${Math.round((admin / direct) * 100)}% of direct)` : ''}</td><td colSpan={2} /></tr>}
                    <tr><td colSpan={6} className="px-4 py-3 text-right text-[12px] uppercase text-ink-500">Total approved</td><td className="px-4 py-3 text-right text-[15px] font-semibold tabular-nums">{fmtMoney(total, meta.currency)}</td><td /></tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Project / grant" description="Pre-filled from the file's Summary / header block where found">
            <div className="space-y-4">
              <Field label="Project / donor code" required hint="Shown to requesters in the requisition dropdown"><input className="input font-mono" value={meta.donorCode} onChange={(e) => setMeta({ ...meta, donorCode: e.target.value })} placeholder="e.g. RHS202600XXX" /></Field>
              <Field label="Project title" required><input className="input" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
              <Field label="Donor / funding source"><input className="input" value={meta.donor} onChange={(e) => setMeta({ ...meta, donor: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Currency"><select className="input" value={meta.currency} onChange={(e) => setMeta({ ...meta, currency: e.target.value as Currency })}><option>JOD</option><option>USD</option><option>EUR</option></select></Field><Field label="Duration"><input className="input" value={meta.duration} onChange={(e) => setMeta({ ...meta, duration: e.target.value })} placeholder="18 Months" /></Field></div>
              <Field label="Locations"><input className="input" value={meta.locations} onChange={(e) => setMeta({ ...meta, locations: e.target.value })} /></Field>
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
