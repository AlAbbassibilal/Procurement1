import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { useStore, useCurrentUser } from '@/store/useStore'
import { Card, PageHeader, Stat } from '@/components/ui'
import { DEPT, ACCESS_LABEL, accessOf } from '@/lib/departments'
import { DEPT_ICON } from '@/pages/Home'
import { computeBvA } from '@/lib/budget'
import { coverageFor } from '@/lib/master'
import { staffCoverage } from '@/lib/salary'
import { contractDaysLeft, onLeaveToday, today as todayIso } from '@/lib/hr'
import { invoiceTotals } from '@/lib/match'
import { ddProgress, partnerProjects, riskLevel, PARTNER_STAGE_LABEL } from '@/lib/partners'
import { PartnerStagePill, DdBar, ProjectChips } from '@/pages/partnerships/shared'
import { PARTNER_STAGES } from '@/types'
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
  const { invoices, budgets, prs, pos, settings, masterBudgets, projects, staff } = useStore()
  const ccy = settings.defaultCurrency
  const sc = staffCoverage(staff.filter((s) => s.status !== 'left'), budgets, projects, new Date().getFullYear(), settings); const sAnnual = sc.reduce((s, c) => s + c.annual, 0), sCov = sc.reduce((s, c) => s + c.covered, 0)
  const mb = [...masterBudgets].sort((a, b) => b.year - a.year)[0]
  const cov = mb ? coverageFor(mb, budgets, projects, settings) : []
  const mTotal = cov.reduce((s, c) => s + c.line.amount, 0), mCov = cov.reduce((s, c) => s + c.covered, 0)
  const sum = (st: string[]) => invoices.filter((i) => st.includes(i.status)).reduce((s, i) => s + invoiceTotals(i.lines, i.taxRate).total, 0)
  const bv = budgets.filter((b) => b.status === 'active').map((b) => computeBvA(b, prs, pos, invoices).totals)
  return (
    <WorkspaceFrame id="finance" intro={
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="Invoices awaiting approval" value={fmtMoney(sum(['pending_approval']), ccy)} tone="sun" />
        <Stat label="Match exceptions" value={invoices.filter((i) => i.status === 'exception').length} tone="accent" />
        <Stat label="Approved — to pay" value={fmtMoney(sum(['approved']), ccy)} tone="brand" />
        <Stat label="Committed across projects" value={fmtMoney(bv.reduce((s, t) => s + t.commitments, 0), ccy)} />
        <Stat label={`Salaries ${new Date().getFullYear()} covered by projects`} value={`${sAnnual ? Math.round((sCov / sAnnual) * 100) : 0}%`} hint={`${staff.filter((s) => s.status === 'planned').length} position(s) to recruit · gap ${fmtMoney(Math.max(0, sAnnual - sCov), ccy)}`} tone={sAnnual && sCov / sAnnual < 0.7 ? 'accent' : 'brand'} />
        {mb && <Stat label={`Master budget ${mb.year} covered by projects`} value={`${mTotal ? Math.round((mCov / mTotal) * 100) : 0}%`} hint={`${fmtMoney(mCov, mb.currency)} of ${fmtMoney(mTotal, mb.currency)} · gap ${fmtMoney(Math.max(0, mTotal - mCov), mb.currency)}`} tone={mTotal && mCov / mTotal < 0.5 ? 'accent' : 'brand'} />}
      </div>
    } />
  )
}

export function PartnershipsHome() {
  const { partners, projects, country } = useStore()
  const list = partners.filter((p) => country === 'all' || p.country === country)
  const inDD = list.filter((p) => p.stage === 'due_diligence')
  const awaiting = list.filter((p) => ddProgress(p.dueDiligence).partnerPending)
  const received = list.filter((p) => p.dueDiligence.vetting.share?.status === 'submitted' && !p.dueDiligence.vetting.completedAt)
  const highRisks = list.reduce((n, p) => n + p.dueDiligence.risks.filter((r) => ['High', 'Very High'].includes(riskLevel(r.likelihood, r.impact) ?? '')).length, 0)
  const active = list.filter((p) => p.stage === 'active')
  return (
    <WorkspaceFrame id="partnerships" intro={
      <>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Partners on the register" value={list.length} hint={`${active.length} active · ${list.filter((p) => p.stage === 'declined').length} declined`} tone="brand" />
          <Stat label="In due diligence" value={inDD.length} tone="sun" />
          <Stat label="Awaiting partner vetting form" value={awaiting.length} hint={received.length ? `${received.length} received — to review` : undefined} tone={received.length ? 'brand' : 'default'} />
          <Stat label="High / very high risks open" value={highRisks} tone={highRisks ? 'accent' : 'default'} />
          <Stat label="Projects with partners" value={projects.filter((p) => (p.partnerIds?.length ?? 0) > 0 && ['granted', 'active'].includes(p.stage)).length} />
        </div>
        <div className="mb-6 grid gap-6 xl:grid-cols-3">
          <Card title="Pipeline by stage" padded={false} className="xl:col-span-1">
            <ul className="divide-y divide-line">{PARTNER_STAGES.concat('declined').map((s) => { const ps = list.filter((p) => p.stage === s); return <li key={s} className="flex items-center justify-between px-5 py-2.5 text-[13px]"><Link to={`/partnerships/partners`} className="flex items-center gap-2 hover:underline"><PartnerStagePill stage={s} /></Link><span className="font-semibold text-ink-900">{ps.length}</span></li> })}</ul>
          </Card>
          <Card title="Where we are with each partner" padded={false} className="xl:col-span-2" actions={<Link to="/partnerships/partners" className="btn-secondary btn-sm">Open register <ArrowRight size={13} /></Link>}>
            <ul className="divide-y divide-line">{list.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-ink-500">No partners yet.</li>}{[...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8).map((p) => <li key={p.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_auto_200px] sm:items-center"><div><Link to={`/partnerships/${p.id}`} className="text-[13.5px] font-medium text-ink-900 hover:text-brand-700">{p.name}{p.acronym && ` (${p.acronym})`}</Link><div className="text-[12px] text-ink-500">{p.country} · {PARTNER_STAGE_LABEL[p.stage]}{ddProgress(p.dueDiligence).partnerPending && ' · awaiting partner form'}</div><div className="mt-1"><ProjectChips projects={partnerProjects(p, projects)} empty="" /></div></div><PartnerStagePill stage={p.stage} /><DdBar partner={p} /></li>)}</ul>
          </Card>
        </div>
      </>
    } />
  )
}
export function HrHome() {
  const { staff, leaveRequests, timesheets, attendance } = useStore()
  const active = staff.filter((s) => s.status === 'active')
  const ending = active.filter((s) => { const d = contractDaysLeft(s); return d !== null && d >= 0 && d <= 60 })
  const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  return (
    <WorkspaceFrame id="hr" intro={
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Active staff" value={active.length} hint={`${staff.filter((s) => s.status === 'planned').length} to recruit`} tone="brand" />
        <Stat label="Checked in today" value={attendance.filter((a) => a.date === todayIso()).length} hint={`${leaveRequests.filter((r) => onLeaveToday(r)).length} on leave / WFH`} />
        <Stat label="Requests pending" value={leaveRequests.filter((r) => r.status === 'pending').length} tone={leaveRequests.some((r) => r.status === 'pending') ? 'sun' : 'default'} />
        <Stat label="Timesheets awaiting" value={timesheets.filter((t) => ['submitted', 'acknowledged'].includes(t.status)).length} hint={`${active.length - timesheets.filter((t) => t.period === ym).length} not started for ${ym}`} />
        <Stat label="Contracts ending ≤ 60 days" value={ending.length} hint={ending.map((s) => s.name).join(', ') || undefined} tone={ending.length ? 'accent' : 'default'} />
      </div>
    } />
  )
}
export const MediaHome = () => <WorkspaceFrame id="media" />
