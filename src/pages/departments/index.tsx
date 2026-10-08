import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat } from '@/components/ui'
import { DEPT, ACCESS_LABEL, accessOf } from '@/lib/departments'
import { DEPT_ICON } from '@/pages/Home'
import { computeBvA } from '@/lib/budget'
import { invoiceTotals } from '@/lib/match'
import { fmtMoney, cx } from '@/lib/format'
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
