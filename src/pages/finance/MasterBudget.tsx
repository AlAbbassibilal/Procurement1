import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Download, CheckCircle2, Undo2, Copy, Landmark } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Modal, Field, Alert, Stat, StatusPill } from '@/components/ui'
import { coverageFor, exportMasterBudget, masterCode, MASTER_CATEGORIES, type Coverage } from '@/lib/master'
import { fmtMoney, fmtDate, fmtDateTime, uid, cx } from '@/lib/format'
import type { MasterLine } from '@/types'

export default function MasterBudgetPage() {
  const user = useCurrentUser()!
  const { masterBudgets, budgets, projects, users, settings, country, createMasterBudget, upsertMasterLine, deleteMasterLine, approveMasterBudget, reopenMasterBudget } = useStore()
  const years = [...masterBudgets].sort((a, b) => b.year - a.year)
  const [yearId, setYearId] = useState(years[0]?.id ?? '')
  const mb = masterBudgets.find((m) => m.id === yearId) ?? years[0]
  const [edit, setEdit] = useState<MasterLine | null>(null)
  const [open, setOpen] = useState<Coverage | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const isFD = ['finance_director', 'executive_director', 'admin'].includes(user.role)
  const cov = useMemo(() => (mb ? coverageFor(mb, budgets, projects, settings) : []), [mb, budgets, projects, settings])
  const shown = cov.filter((c) => country === 'all' || c.line.country === country)
  const total = shown.reduce((s, c) => s + c.line.amount, 0), covered = shown.reduce((s, c) => s + c.covered, 0), pipeline = shown.reduce((s, c) => s + c.pipeline, 0)
  const canEditLine = (l: MasterLine) => !!mb && (mb.status === 'draft' ? isFD || l.budgetHolderId === user.id || !l.budgetHolderId : isFD)
  const categories = [...new Set(shown.map((c) => c.line.category))]
  const newLine = (): MasterLine => ({ id: uid('ml_'), code: masterCode(mb!.year, mb!.lines.length + 1), accountName: '', category: MASTER_CATEGORIES[0]!, country: settings.countries[0]!, amount: 0, budgetHolderId: user.id, budgetHolderName: user.name })
  if (!mb) return (
    <><PageHeader title="Master budget" subtitle="The organisation's annual running costs — the reference every project budget maps onto." actions={isFD && <button className="btn-primary" onClick={() => setYearId(createMasterBudget(new Date().getFullYear()).id)}><Plus size={15} /> Create {new Date().getFullYear()} master budget</button>} /><Alert tone="info">No master budget yet. The Director of Finance &amp; Support creates the year; budget holders fill their lines; the Director approves.</Alert></>
  )
  return (
    <>
      <PageHeader eyebrow={<span className="flex items-center gap-2"><Landmark size={14} /> Financial · master budget</span>} title={`Master budget ${mb.year}`}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={mb.status === 'approved' ? 'approved' : 'draft'} /><span>{mb.currency}</span><span>· {mb.lines.length} lines</span>{mb.approvedAt && <span>· approved by {mb.approvedByName} on {fmtDate(mb.approvedAt)}</span>}<span>· Owner {mb.ownerName}</span>{country !== 'all' && <span className="rounded-pill bg-info-50 px-2 text-info-700">filtered: {country}</span>}</span>}
        actions={<>
          <select className="input w-36" value={mb.id} onChange={(e) => setYearId(e.target.value)}>{years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}</select>
          {isFD && <button className="btn-secondary" onClick={() => { const y = Number(prompt('Year for the new master budget', String(mb.year + 1))); if (y) setYearId(createMasterBudget(y, mb.id).id) }}><Copy size={15} /> New year from this</button>}
          <button className="btn-secondary" onClick={() => exportMasterBudget(mb, cov, settings)}><Download size={15} /> Export</button>
          {mb.status === 'draft' && <button className="btn-primary" onClick={() => { setErr(null); setEdit(newLine()) }}><Plus size={15} /> Add line</button>}
          {isFD && mb.status === 'draft' && <button className="btn-primary" onClick={() => { const r = approveMasterBudget(mb.id); if (!r.ok) setErr(r.error ?? 'Failed') }}><CheckCircle2 size={15} /> Approve {mb.year}</button>}
          {isFD && mb.status === 'approved' && <button className="btn-ghost" onClick={() => reopenMasterBudget(mb.id)}><Undo2 size={15} /> Re-open</button>}
        </>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Annual running costs ${mb.year}`} value={fmtMoney(total, mb.currency)} tone="brand" />
        <Stat label="Covered by active projects" value={fmtMoney(covered, mb.currency)} hint={`${total ? Math.round((covered / total) * 100) : 0}% of the master budget`} tone="brand" />
        <Stat label="Funding gap" value={fmtMoney(Math.max(0, total - covered), mb.currency)} tone={total - covered > 0 ? 'accent' : 'default'} hint="not yet funded by any project" />
        <Stat label="In pipeline (draft budgets)" value={fmtMoney(pipeline, mb.currency)} tone="sun" hint="proposals under development / submitted" />
      </div>
      <Card title="Lines by category" description="Click a line to see which project lines fund it. Coverage counts active (granted) budgets, prorated to the months inside the year; pipeline shows proposals." padded={false}>
        <div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[1100px] text-[13px]">
          <thead><tr><th className="table-th">Code</th><th className="table-th">Account / line</th><th className="table-th">Country</th><th className="table-th">Budget holder</th><th className="table-th text-right">Annual budget</th><th className="table-th text-right">Covered</th><th className="table-th w-44">Coverage</th><th className="table-th text-right">Gap</th><th className="table-th text-center">Projects</th><th className="table-th text-right">Pipeline</th><th className="table-th w-16" /></tr></thead>
          <tbody>
            {categories.map((cat) => (<Fragment key={cat}>
              <tr><td colSpan={11} className="px-4 pt-3 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink-500">{cat} · {fmtMoney(shown.filter((c) => c.line.category === cat).reduce((s, c) => s + c.line.amount, 0), mb.currency)}</td></tr>
              {shown.filter((c) => c.line.category === cat).map((c) => (
                <tr key={c.line.id} className="cursor-pointer border-t border-line hover:bg-surface-muted" onClick={() => setOpen(c)}>
                  <td className="table-td font-mono text-[12px] font-semibold text-brand-700">{c.line.code}</td>
                  <td className="table-td"><div className="font-medium text-ink-900">{c.line.accountName}</div><div className="text-[11.5px] text-ink-500">acct {c.line.accountNo ?? '—'}{c.line.notes && ` · ${c.line.notes}`}</div></td>
                  <td className="table-td text-ink-600">{c.line.country}</td>
                  <td className="table-td text-ink-600">{c.line.budgetHolderName ?? <span className="text-sun-700">unassigned</span>}</td>
                  <td className="table-td text-right tabular-nums">{fmtMoney(c.line.amount, mb.currency)}</td>
                  <td className="table-td text-right tabular-nums text-brand-700">{fmtMoney(c.covered, mb.currency)}</td>
                  <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', c.pct >= 100 ? 'bg-brand-600' : c.pct >= 50 ? 'bg-sun-500' : 'bg-accent-600')} style={{ width: `${Math.min(100, c.pct)}%` }} /></div><span className={cx('w-10 text-right tabular-nums font-medium', c.pct >= 100 ? 'text-brand-700' : c.pct >= 50 ? 'text-sun-700' : 'text-accent-700')}>{c.pct}%</span></div></td>
                  <td className={cx('table-td text-right tabular-nums', c.gap > 0 ? 'text-accent-700' : 'text-ink-500')}>{fmtMoney(c.gap, mb.currency)}</td>
                  <td className="table-td text-center"><span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-[11.5px] font-semibold">{c.projects}</span></td>
                  <td className="table-td text-right tabular-nums text-sun-700">{c.pipeline ? fmtMoney(c.pipeline, mb.currency) : '—'}</td>
                  <td className="table-td"><div className="flex gap-1" onClick={(e) => e.stopPropagation()}>{canEditLine(c.line) && <button className="btn-ghost btn-sm" onClick={() => { setErr(null); setEdit(c.line) }}><Pencil size={13} /></button>}{isFD && mb.status === 'draft' && <button className="btn-ghost btn-sm text-accent-700" onClick={() => confirm('Remove this master line? Project lines mapped to it will be unlinked.') && deleteMasterLine(mb.id, c.line.id)}><Trash2 size={13} /></button>}</div></td>
                </tr>))}
            </Fragment>))}
            {shown.length === 0 && <tr><td colSpan={11} className="px-5 py-8 text-center text-ink-500">No lines{country !== 'all' ? ` for ${country}` : ''} yet.</td></tr>}
          </tbody>
          <tfoot><tr className="bg-surface-muted font-semibold"><td className="table-td" colSpan={4}>TOTAL</td><td className="table-td text-right tabular-nums">{fmtMoney(total, mb.currency)}</td><td className="table-td text-right tabular-nums text-brand-700">{fmtMoney(covered, mb.currency)}</td><td className="table-td tabular-nums">{total ? Math.round((covered / total) * 100) : 0}%</td><td className="table-td text-right tabular-nums">{fmtMoney(Math.max(0, total - covered), mb.currency)}</td><td /><td className="table-td text-right tabular-nums text-sun-700">{fmtMoney(pipeline, mb.currency)}</td><td /></tr></tfoot>
        </table></div>
      </Card>
      <div className="mt-4 text-[12px] text-ink-500">Budget holders fill their own lines while the year is in draft; the Director of Finance &amp; Support approves. Project budgets reference these lines (the <b>MB-{mb.year}-…</b> code next to the project's BL#) — see the Budget tab of any project.</div>

      {/* Line editor */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit && mb.lines.some((l) => l.id === edit.id) ? `Edit ${edit.code}` : 'Add master line'} width="max-w-2xl"
        footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => { if (!edit?.accountName.trim()) return setErr('Line name is required.'); upsertMasterLine(mb.id, edit!); setEdit(null) }}>Save line</button></>}>
        {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
        {edit && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code"><input className="input font-mono" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
          <Field label="Account no." hint="Chart of accounts (2601 …)"><input className="input font-mono" value={edit.accountNo ?? ''} onChange={(e) => setEdit({ ...edit, accountNo: e.target.value })} /></Field>
          <Field label="Account / line name" required className="sm:col-span-2"><input className="input" value={edit.accountName} onChange={(e) => setEdit({ ...edit, accountName: e.target.value })} /></Field>
          <Field label="Category"><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{MASTER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Country"><select className="input" value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })}>{settings.countries.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Budget holder" hint="Fills and owns this line"><select className="input" value={edit.budgetHolderId ?? ''} disabled={!isFD} onChange={(e) => setEdit({ ...edit, budgetHolderId: e.target.value || undefined, budgetHolderName: users.find((u) => u.id === e.target.value)?.name })}><option value="">— unassigned —</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}</select></Field>
          <Field label={`Annual amount (${mb.currency})`} required><input type="number" className="input" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} /></Field>
          <Field label="Notes / basis of calculation" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
        </div>}
      </Modal>
      {/* Coverage drawer */}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.line.code} · ${open.line.accountName}` : ''} width="max-w-3xl" footer={<button className="btn-secondary" onClick={() => setOpen(null)}>Close</button>}>
        {open && <>
          <div className="mb-3 grid grid-cols-4 gap-3 text-center text-[12.5px]"><div className="rounded-control bg-surface-muted p-2"><div className="text-ink-500">Annual</div><div className="font-semibold">{fmtMoney(open.line.amount, mb.currency)}</div></div><div className="rounded-control bg-brand-50 p-2"><div className="text-ink-500">Covered</div><div className="font-semibold text-brand-800">{fmtMoney(open.covered, mb.currency)} · {open.pct}%</div></div><div className="rounded-control bg-surface-muted p-2"><div className="text-ink-500">Gap</div><div className={cx('font-semibold', open.gap > 0 && 'text-accent-700')}>{fmtMoney(open.gap, mb.currency)}</div></div><div className="rounded-control bg-sun-50 p-2"><div className="text-ink-500">Pipeline</div><div className="font-semibold text-sun-700">{fmtMoney(open.pipeline, mb.currency)}</div></div></div>
          {open.lines.length === 0 ? <Alert tone="warning">No project budget line references this master line yet. Map lines from a project's Budget tab (column "Master line").</Alert> : (
            <table className="w-full text-[12.5px]"><thead><tr><th className="table-th">Project</th><th className="table-th">Project line</th><th className="table-th">Budget status</th><th className="table-th text-right">Line amount</th><th className="table-th text-right">Prorated to {mb.year}</th></tr></thead>
              <tbody>{open.lines.map((l) => <tr key={l.budget.id + l.line.id} className="border-t border-line"><td className="table-td">{l.project ? <Link to={`/grants/${l.project.id}?tab=budget`} className="font-medium text-brand-700 hover:underline">{l.budget.donorCode}</Link> : <Link to={`/budgets/${l.budget.id}`} className="font-medium text-brand-700 hover:underline">{l.budget.donorCode}</Link>}<div className="text-[11.5px] text-ink-500">{l.budget.name}</div></td><td className="table-td"><span className="font-mono text-[11.5px]">{l.line.code}</span> {l.line.description}</td><td className="table-td"><StatusPill status={l.status} /></td><td className="table-td text-right tabular-nums">{fmtMoney(l.amount, mb.currency)}</td><td className={cx('table-td text-right tabular-nums font-medium', l.status !== 'active' && 'text-ink-400')}>{fmtMoney(l.prorated, mb.currency)}</td></tr>)}</tbody></table>
          )}
          <div className="mt-3 text-[11.5px] text-ink-500">Holder: {open.line.budgetHolderName ?? '—'} · {open.line.country} · last filled {fmtDateTime(open.line.filledAt)}</div>
        </>}
      </Modal>
    </>
  )
}
import { Fragment } from 'react'
