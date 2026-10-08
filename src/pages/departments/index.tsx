import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Upload } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat, StatusPill, EmptyState } from '@/components/ui'
import { DEPT, ACCESS_LABEL, accessOf } from '@/lib/departments'
import { DEPT_ICON } from '@/pages/Home'
import { computeBvA } from '@/lib/budget'
import { invoiceTotals } from '@/lib/match'
import { fmtMoney, fmtDate, cx } from '@/lib/format'
import type { Department } from '@/types'

/** Shared workspace landing frame: header, module grid, and a "to be defined" panel. */
function WorkspaceFrame({ id, children, intro }: { id: Department; children?: React.ReactNode; intro?: React.ReactNode }) {
  const user = useCurrentUser()!
  const d = DEPT[id]
  const lvl = accessOf(user, id)
  const live = d.modules.filter((m) => !m.soon && m.to !== d.home), soon = d.modules.filter((m) => m.soon)
  return (
    <>
      <PageHeader eyebrow={<span className="flex items-center gap-2"><span className={cx('flex h-6 w-6 items-center justify-center rounded-control [&>svg]:h-3.5 [&>svg]:w-3.5', d.tone.tile)}>{DEPT_ICON[id]}</span> Workspace · your access: {ACCESS_LABEL[lvl]}</span>} title={d.name} subtitle={d.description} />
      {intro}
      {children}
      <div className={cx('grid gap-6', live.length ? 'xl:grid-cols-3' : '')}>
        {live.length > 0 && (
          <div className="xl:col-span-2"><Card title="Modules" padded={false}>
            <ul className="divide-y divide-line">{live.map((m) => <li key={m.to + m.label}><Link to={m.to} className="flex items-center justify-between px-5 py-3 text-[13.5px] font-medium text-ink-900 hover:bg-surface-muted">{m.label}<ArrowRight size={15} className="text-ink-400" /></Link></li>)}</ul>
          </Card></div>
        )}
        {soon.length > 0 && (
          <Card title="To be defined" description="Module slots reserved for this workspace — scope to be described with Bilal Abbassi">
            <ul className="space-y-2">{soon.map((m) => <li key={m.to} className="flex items-center gap-2 text-[13px] text-ink-600"><ClipboardList size={14} className="text-ink-400" />{m.label}<span className="ml-auto rounded-pill border border-dashed border-ink-300 px-1.5 text-[10.5px] text-ink-400">soon</span></li>)}</ul>
          </Card>
        )}
      </div>
    </>
  )
}

export function GrantsHome() {
  const { budgets, prs, pos, invoices, settings } = useStore()
  const rows = budgets.map((b) => ({ b, t: computeBvA(b, prs, pos, invoices).totals }))
  const active = rows.filter((r) => r.b.status === 'active')
  const ccy = settings.defaultCurrency
  return (
    <WorkspaceFrame id="grants" intro={
      <>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Active projects / grants" value={active.length} tone="brand" />
          <Stat label="Approved budgets" value={fmtMoney(active.reduce((s, r) => s + r.t.budget, 0), ccy)} />
          <Stat label="Spent + committed" value={fmtMoney(active.reduce((s, r) => s + r.t.actual + r.t.commitments, 0), ccy)} tone="sun" />
        </div>
        <div className="mb-6"><Card title="Project & grant register" description="Every requisition, payment and report is charged to one of these codes" padded={false}
          actions={<Link to="/budgets/upload" className="btn-primary btn-sm"><Upload size={13} /> Add project budget</Link>}>
          {rows.length === 0 ? <div className="p-5"><EmptyState title="No projects yet" /></div> : (
            <div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[720px] text-[13px]">
              <thead><tr><th className="table-th">Project / grant</th><th className="table-th">Donor</th><th className="table-th">Period</th><th className="table-th text-right">Approved</th><th className="table-th w-44">Burn</th><th className="table-th">Status</th></tr></thead>
              <tbody>{rows.map(({ b, t }) => <tr key={b.id} className="hover:bg-surface-muted"><td className="table-td"><Link to={`/budgets/${b.id}`} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">{b.donorCode}</Link><div className="font-medium text-ink-900">{b.name}</div></td><td className="table-td text-ink-600">{b.donor}</td><td className="table-td whitespace-nowrap text-ink-600">{fmtDate(b.startDate)} – {fmtDate(b.endDate)}</td><td className="table-td text-right tabular-nums">{fmtMoney(t.budget, b.currency)}</td><td className="table-td"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-pill bg-ink-100"><div className={cx('h-full rounded-pill', t.burnWithCommitPct > 90 ? 'bg-accent-600' : 'bg-brand-600')} style={{ width: `${Math.min(100, t.burnWithCommitPct)}%` }} /></div><span className="w-10 text-right tabular-nums">{t.burnWithCommitPct}%</span></div></td><td className="table-td"><StatusPill status={b.status} /></td></tr>)}</tbody>
            </table></div>
          )}
        </Card></div>
      </>
    } />
  )
}

export function FinanceHome() {
  const { invoices, budgets, prs, pos, settings } = useStore()
  const ccy = settings.defaultCurrency
  const sum = (st: string[]) => invoices.filter((i) => st.includes(i.status)).reduce((s, i) => s + invoiceTotals(i.lines, i.taxRate).total, 0)
  const bv = budgets.filter((b) => b.status === 'active').map((b) => computeBvA(b, prs, pos, invoices).totals)
  return (
    <WorkspaceFrame id="finance" intro={
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invoices awaiting approval" value={fmtMoney(sum(['pending_approval']), ccy)} tone="sun" />
        <Stat label="Match exceptions" value={invoices.filter((i) => i.status === 'exception').length} tone="accent" />
        <Stat label="Approved — to pay" value={fmtMoney(sum(['approved']), ccy)} tone="brand" />
        <Stat label="Committed across projects" value={fmtMoney(bv.reduce((s, t) => s + t.commitments, 0), ccy)} />
      </div>
    } />
  )
}

export const PartnershipsHome = () => <WorkspaceFrame id="partnerships" />
export const HrHome = () => <WorkspaceFrame id="hr" />
export const MediaHome = () => <WorkspaceFrame id="media" />
