import { Fragment, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, KV, Alert, StatusPill, Field } from '@/components/ui'
import { Logo } from '@/components/Logo'
import { fmtMoney, fmtDate, fmtDateTime, cx } from '@/lib/format'
import { computeBvA, exportBvA, type BvARow } from '@/lib/budget'

export default function BudgetDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { budgets, prs, pos, invoices, settings, upsertBudget, masterBudgets, trips } = useStore()
  const masterLines = masterBudgets.flatMap((m) => m.lines)
  const b = budgets.find((x) => x.id === id)
  const [received, setReceived] = useState<string | null>(null)
  if (!b) return <Alert tone="danger">Budget not found. <Link to="/budgets" className="underline">Back</Link></Alert>
  const bva = computeBvA(b, prs, pos, invoices, trips)
  const { totals: T, approvedTotal: A, unbudgetedTotal: U } = bva
  const canEdit = ['finance', 'finance_director', 'programs_director', 'admin'].includes(user.role)
  const projectPRs = prs.filter((p) => p.donorCode === b.donorCode)
  const c = b.currency
  const pctCls = (p: number, budget: number) => (!budget ? 'text-accent-700' : p > 100 ? 'text-accent-700 font-semibold' : p > 90 ? 'text-sun-700' : 'text-ink-700')
  const money = (v: number) => fmtMoney(v, c)
  const Row = ({ r, total }: { r: BvARow; total?: boolean }) => (
    <tr className={cx(total ? 'bg-surface-muted font-semibold' : !r.line && 'bg-danger-50/50')}>
      <td className="table-td font-mono text-[12px] font-semibold text-brand-700">{total ? '' : r.code}</td>
      <td className="table-td"><div className={cx('text-ink-900', !total && 'font-medium')}>{r.description}</div>{!total && r.line && (r.line.location || r.line.masterLineId) && <div className="text-[11.5px] text-ink-500">{r.line.location}{r.line.accountNo && ` · acct ${r.line.accountNo}`}{r.line.masterLineId && <span className="ml-1 rounded bg-info-50 px-1 text-info-700">{masterLines.find((m) => m.id === r.line!.masterLineId)?.code}</span>}</div>}</td>
      <td className="table-td text-right tabular-nums">{money(r.budget)}</td>
      <td className="table-td text-right tabular-nums">{money(r.actual)}</td>
      <td className={cx('table-td text-right tabular-nums', r.remaining < 0 && 'text-accent-700')}>{money(r.remaining)}</td>
      <td className={cx('table-td text-right tabular-nums', pctCls(r.burnPct, r.budget))}>{r.budget ? `${r.burnPct}%` : r.line ? '—' : 'Unbudgeted'}</td>
      <td className="table-td text-right tabular-nums text-ink-500">{money(r.forecast)}</td>
      <td className="table-td text-right tabular-nums text-sun-700">{money(r.commitments)}</td>
      <td className="table-td text-right tabular-nums">{money(r.withCommit)}</td>
      <td className={cx('table-td text-right tabular-nums font-semibold', r.remainingWithCommit < 0 ? 'text-accent-700' : 'text-brand-700')}>{money(r.remainingWithCommit)}</td>
      <td className={cx('table-td text-right tabular-nums', pctCls(r.burnWithCommitPct, r.budget))}>{r.budget ? `${r.burnWithCommitPct}%` : '—'}</td>
    </tr>
  )

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{b.donorCode}</span>} title={b.name}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={b.status} /><span>{b.donor}</span>{b.duration && <span>· {b.duration}</span>}{(b.startDate || b.endDate) && <span>· {fmtDate(b.startDate)} – {fmtDate(b.endDate)}</span>}<span>· Owner {b.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
          <button className="btn-primary" onClick={() => exportBvA(b, bva, prs, pos, invoices, settings, user.name)}><Download size={15} /> Export BvA (Excel)</button>
          {canEdit && <button className="btn-secondary" onClick={() => upsertBudget({ ...b, status: b.status === 'active' ? 'closed' : 'active' })}>{b.status === 'active' ? 'Close budget' : 'Re-open'}</button>}
        </>} />

      <div className="grid gap-6 xl:grid-cols-4">
        <div className="space-y-6 xl:col-span-3">
          <Card padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4"><Logo size="sm" /><div className="text-right text-[12.5px] text-ink-600"><div className="text-[16px] font-semibold text-ink-900">BUDGET vs ACTUAL</div><div className="font-mono">{b.donorCode}</div><div>As at {fmtDate(new Date().toISOString())} · {c}</div></div></div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1240px] text-[13px]">
                <thead><tr><th className="table-th">Line</th><th className="table-th">Description</th><th className="table-th text-right">Total amount</th><th className="table-th text-right">Actual</th><th className="table-th text-right">Remaining</th><th className="table-th text-right">Burn rate</th><th className="table-th text-right">Forecast (PRs)</th><th className="table-th text-right">Commitments</th><th className="table-th text-right">Actual + commit. + forecast</th><th className="table-th text-right">Remaining with commit.</th><th className="table-th text-right">Burn with commit.</th></tr></thead>
                <tbody>
                  {bva.sections.map((s) => (<Fragment key={s.name}>
                    <tr><td colSpan={11} className="px-4 pt-3 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink-500">{s.name}</td></tr>
                    {s.rows.map((r) => <Row key={r.code + r.section} r={r} />)}
                    <Row r={s.total} total />
                  </Fragment>))}
                  {bva.unbudgeted.length > 0 && (<>
                    <tr><td colSpan={11} className="px-4 pt-3 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-accent-700">Unbudgeted expenses (not in approved budget)</td></tr>
                    {bva.unbudgeted.map((r) => <Row key={r.code} r={r} />)}
                    <Row r={U} total />
                  </>)}
                </tbody>
                <tfoot><Row r={T} total /></tfoot>
              </table>
            </div>
            <div className="border-t border-line px-5 py-3 text-[11.5px] text-ink-500">Columns follow the RHS BvA sheet (Annex 1). Actual = paid invoices · Commitments = approved / issued purchase orders not yet paid · Forecast = requisitions in approval or sourcing · Remaining = Total − Actual · Remaining with commitments = Total − (Actual + Commitments + Forecast). Rows shaded red are charged to codes that are not in the approved budget.</div>
          </Card>

          <Card title="Transactions charged to this budget" padded={false}>
            {projectPRs.length === 0 ? <div className="px-5 py-6 text-center text-[13px] text-ink-500">No requisitions yet.</div> : (
              <table className="w-full text-[13px]"><thead><tr><th className="table-th">Requisition</th><th className="table-th">Lines → budget</th><th className="table-th">Status</th><th className="table-th text-right">Value</th></tr></thead>
                <tbody>{projectPRs.map((p) => <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/requisitions/${p.id}`)}><td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="font-mono text-[11.5px] text-ink-500">{p.number}{p.poId && ` · ${pos.find((x) => x.id === p.poId)?.number ?? ''}`}</div></td><td className="table-td text-ink-600">{[...new Set(p.lines.map((l) => l.budgetLine))].join(', ')}</td><td className="table-td"><StatusPill status={p.status} /></td><td className="table-td text-right tabular-nums">{fmtMoney(p.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), p.currency)}</td></tr>)}</tbody></table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Financial summary" description="As in the BvA template">
            {canEdit ? (
              <Field label={`Donation received from ${b.donor || 'donor'} (${c})`}><div className="flex gap-2"><input type="number" className="input" value={received ?? (b.fundsReceived ?? '')} onChange={(e) => setReceived(e.target.value)} placeholder="0" />{received !== null && <button className="btn-secondary btn-sm" onClick={() => { upsertBudget({ ...b, fundsReceived: Number(received) || 0 }); setReceived(null) }}>Save</button>}</div></Field>
            ) : <KV k="Donation received" v={money(b.fundsReceived ?? 0)} />}
            <div className="mt-3 space-y-0.5">
              <KV k="Approved budget" v={money(A.budget)} />
              <KV k="Spent on approved lines" v={money(A.actual)} />
              <KV k="Spent on unbudgeted lines" v={<span className={U.actual ? 'text-accent-700' : undefined}>{money(U.actual)}</span>} />
              <KV k="Total spent" v={<b>{money(T.actual)}</b>} />
              <KV k="Remaining approved budget" v={money(A.budget - T.actual)} />
              <KV k="Cash balance" v={<span className={(b.fundsReceived ?? 0) - T.actual < 0 ? 'text-accent-700' : undefined}>{money((b.fundsReceived ?? 0) - T.actual)}</span>} />
              <KV k="Overall burn rate" v={`${A.budget ? Math.round((T.actual / A.budget) * 100) : 0}%`} />
            </div>
            <div className="mt-3 h-2 w-full rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', A.burnWithCommitPct > 90 ? 'bg-accent-600' : 'bg-brand-600')} style={{ width: `${Math.min(100, A.burnWithCommitPct)}%` }} /></div>
            <div className="mt-1 text-[12px] text-ink-600">{A.burnWithCommitPct}% incl. commitments & forecast</div>
          </Card>
          <Card title="Source document"><KV k="Uploaded by" v={`${b.uploadedByName} · ${fmtDateTime(b.uploadedAt)}`} /><KV k="File" v={b.sourceFile ? (b.sourceFile.dataUrl ? <a href={b.sourceFile.dataUrl} download={b.sourceFile.name} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><FileSpreadsheet size={13} />{b.sourceFile.name}</a> : b.sourceFile.name) : 'Entered manually'} />{b.sourceSheet && <KV k="Sheet(s)" v={b.sourceSheet} />}{b.locations && <KV k="Locations" v={b.locations} />}<KV k="Lines" v={`${b.lines.length} · ${b.lines.filter((l) => l.costType === 'direct').length} direct · ${b.lines.filter((l) => l.costType === 'admin').length} admin`} /><KV k="Document owner" v={b.ownerName} />{b.notes && <KV k="Notes" v={b.notes} />}</Card>
          <Card title="Export layout"><p className="text-[12.5px] text-ink-600">The Excel export follows the RHS BvA template{settings.templates.bva ? <> (<b>{settings.templates.bva.name}</b>)</> : ''}: sheets <b>Project Budget</b>, <b>BvA</b> (with live formulas and monthly forecast columns), <b>Expense Allocation</b> and <b>Commitments</b>.</p></Card>
        </div>
      </div>
    </>
  )
}
