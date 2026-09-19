import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, KV, Alert, StatusPill } from '@/components/ui'
import { Logo } from '@/components/Logo'
import { fmtMoney, fmtDate, fmtDateTime, cx } from '@/lib/format'
import { computeBvA, exportBvA } from '@/lib/budget'

export default function BudgetDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()!
  const { budgets, prs, pos, invoices, settings, upsertBudget } = useStore()
  const b = budgets.find((x) => x.id === id)
  if (!b) return <Alert tone="danger">Budget not found. <Link to="/budgets" className="underline">Back</Link></Alert>
  const { rows, totals } = computeBvA(b, prs, pos, invoices)
  const canEdit = ['finance', 'finance_director', 'programs_director', 'admin'].includes(user.role)
  const projectPRs = prs.filter((p) => p.donorCode === b.donorCode)
  const tone = (pct: number) => (pct > 100 ? 'text-accent-700' : pct > 90 ? 'text-sun-700' : 'text-ink-700')

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{b.donorCode}</span>} title={b.name}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><StatusPill status={b.status} /><span>{b.donor}</span><span>· {fmtDate(b.startDate)} – {fmtDate(b.endDate)}</span><span>· Owner {b.ownerName}</span></span>}
        actions={<>
          <button className="btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={15} /> Back</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
          <button className="btn-primary" onClick={() => exportBvA(b, rows, totals, settings.orgName, user.name)}><Download size={15} /> Export BvA (Excel)</button>
          {canEdit && <button className="btn-secondary" onClick={() => upsertBudget({ ...b, status: b.status === 'active' ? 'closed' : 'active' })}>{b.status === 'active' ? 'Close budget' : 'Re-open'}</button>}
        </>} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4"><Logo size="sm" /><div className="text-right text-[12.5px] text-ink-600"><div className="text-[16px] font-semibold text-ink-900">BUDGET vs ACTUAL</div><div className="font-mono">{b.donorCode}</div><div>As at {fmtDate(new Date().toISOString())} · {b.currency}</div></div></div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead><tr><th className="table-th">Line</th><th className="table-th">Description</th><th className="table-th text-right">Approved</th><th className="table-th text-right">Requested</th><th className="table-th text-right">Committed</th><th className="table-th text-right">Actual</th><th className="table-th text-right">Available</th><th className="table-th w-36">Burn</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.code} className={cx(!r.line && 'bg-danger-50/50')}>
                    <td className="table-td font-mono text-[12px] font-semibold text-brand-700">{r.code}</td>
                    <td className="table-td"><div className="font-medium text-ink-900">{r.description}</div>{r.line?.category && <div className="text-[11.5px] text-ink-500">{r.line.category}</div>}</td>
                    <td className="table-td text-right tabular-nums">{fmtMoney(r.budget, b.currency)}</td>
                    <td className="table-td text-right tabular-nums text-ink-500">{fmtMoney(r.requested, b.currency)}</td>
                    <td className="table-td text-right tabular-nums text-sun-700">{fmtMoney(r.committed, b.currency)}</td>
                    <td className="table-td text-right tabular-nums font-medium">{fmtMoney(r.actual, b.currency)}</td>
                    <td className={cx('table-td text-right tabular-nums font-semibold', r.available < 0 ? 'text-accent-700' : 'text-brand-700')}>{fmtMoney(r.available, b.currency)}</td>
                    <td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', r.burnPct > 100 ? 'bg-accent-600' : r.burnPct > 90 ? 'bg-sun-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, r.burnPct)}%` }} /></div><span className={cx('w-10 text-right tabular-nums', tone(r.burnPct))}>{r.burnPct}%</span></div></td>
                  </tr>))}</tbody>
                <tfoot><tr className="bg-surface-muted font-semibold"><td className="table-td" colSpan={2}>TOTAL</td><td className="table-td text-right tabular-nums">{fmtMoney(totals.budget, b.currency)}</td><td className="table-td text-right tabular-nums text-ink-500">{fmtMoney(totals.requested, b.currency)}</td><td className="table-td text-right tabular-nums text-sun-700">{fmtMoney(totals.committed, b.currency)}</td><td className="table-td text-right tabular-nums">{fmtMoney(totals.actual, b.currency)}</td><td className={cx('table-td text-right tabular-nums', totals.available < 0 ? 'text-accent-700' : 'text-brand-700')}>{fmtMoney(totals.available, b.currency)}</td><td className="table-td tabular-nums">{totals.burnPct}%</td></tr></tfoot>
              </table>
            </div>
            <div className="border-t border-line px-5 py-3 text-[11.5px] text-ink-500">Requested = requisitions in approval or sourcing · Committed = approved / issued purchase orders not yet paid · Actual = paid invoices · Available = Approved − Committed − Actual. Rows shaded red are charged to codes that are not in the approved budget.</div>
          </Card>

          <Card title="Transactions charged to this budget" padded={false}>
            {projectPRs.length === 0 ? <div className="px-5 py-6 text-center text-[13px] text-ink-500">No requisitions yet.</div> : (
              <table className="w-full text-[13px]"><thead><tr><th className="table-th">Requisition</th><th className="table-th">Lines → budget</th><th className="table-th">Status</th><th className="table-th text-right">Value</th></tr></thead>
                <tbody>{projectPRs.map((p) => <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => nav(`/requisitions/${p.id}`)}><td className="table-td"><div className="font-medium text-ink-900">{p.title}</div><div className="font-mono text-[11.5px] text-ink-500">{p.number}{p.poId && ` · ${pos.find((x) => x.id === p.poId)?.number ?? ''}`}</div></td><td className="table-td text-ink-600">{[...new Set(p.lines.map((l) => l.budgetLine))].join(', ')}</td><td className="table-td"><StatusPill status={p.status} /></td><td className="table-td text-right tabular-nums">{fmtMoney(p.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), p.currency)}</td></tr>)}</tbody></table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Approved budget"><div className="text-[26px] font-semibold text-ink-900">{fmtMoney(totals.budget, b.currency)}</div><div className="text-[12.5px] text-ink-500">{b.lines.length} lines · approved {fmtDate(b.approvedAt)}</div><div className="mt-3 h-2 w-full rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', totals.burnPct > 90 ? 'bg-accent-600' : 'bg-brand-600')} style={{ width: `${Math.min(100, totals.burnPct)}%` }} /></div><div className="mt-1 text-[12px] text-ink-600">{totals.burnPct}% committed + spent · {fmtMoney(totals.available, b.currency)} available</div></Card>
          <Card title="Source document"><KV k="Uploaded by" v={`${b.uploadedByName} · ${fmtDateTime(b.uploadedAt)}`} /><KV k="File" v={b.sourceFile ? (b.sourceFile.dataUrl ? <a href={b.sourceFile.dataUrl} download={b.sourceFile.name} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><FileSpreadsheet size={13} />{b.sourceFile.name}</a> : b.sourceFile.name) : 'Entered manually'} />{b.sourceSheet && <KV k="Sheet" v={b.sourceSheet} />}<KV k="Document owner" v={b.ownerName} />{b.notes && <KV k="Notes" v={b.notes} />}</Card>
          <Card title="BvA template"><p className="text-[12.5px] text-ink-600">{settings.templates.bva ? <>Export follows <b>{settings.templates.bva.name}</b>.</> : <>No BvA template uploaded yet — the export uses the standard layout. Upload the organisation's template under <Link to="/budgets" className="text-brand-700 hover:underline">Budgets &amp; BvA</Link>.</>}</p></Card>
        </div>
      </div>
    </>
  )
}
